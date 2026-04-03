---
title: "Capabilities"
description: "Fine-grained capability-based access control for AI agents — built-in capabilities, high-risk enforcement, grants, and validation."
sidebar_order: 6
---

Capabilities are Storsko's fine-grained permission system for AI agents. Every action an agent wants to take — searching the web, sending an email, executing code, transferring money — must be declared as a capability, granted explicitly to the agent, and validated at runtime before execution.

Think of capabilities as a combination of OAuth scopes and Linux capabilities: they define exactly what an agent is allowed to do, and the governance layer enforces those boundaries on every request.

---

## Why Capabilities Matter

Without a capability system, an AI agent with access to your infrastructure can do anything its underlying tools allow. Storsko's capability model enforces **least privilege** at the agent level:

- An agent that should only read files cannot write them
- An agent that can make phone calls will always require human approval before doing so
- Capability grants are audited and can be revoked at any time

This is particularly important for multi-agent systems where agents spawn sub-agents (`agent.spawn`) or delegate tasks (`agent.delegate`) — the child agent inherits a subset of the parent's capabilities, never more.

---

## Built-in Capabilities

Storsko ships a curated set of built-in capabilities covering common agent actions. Custom capabilities can be defined via the capability registry.

### Communication

| Capability     | Description                                                   | Default HITL Mode |
|----------------|---------------------------------------------------------------|-------------------|
| `phone.call`   | Place outbound phone calls                                    | `escalate`        |
| `email.send`   | Send emails on behalf of the agent's owner                    | `propose`         |
| `email.read`   | Read emails from a connected inbox                            | `notify`          |

### Finance

| Capability          | Description                                              | Default HITL Mode |
|---------------------|----------------------------------------------------------|-------------------|
| `finance.transfer`  | Initiate financial transfers or payments                 | `escalate`        |
| `finance.read`      | Read account balances and transaction history            | `notify`          |

### File System

| Capability    | Description                                                    | Default HITL Mode |
|---------------|----------------------------------------------------------------|-------------------|
| `file.read`   | Read files from connected storage (local, S3, GCS, etc.)      | `auto`            |
| `file.write`  | Write or modify files in connected storage                     | `notify`          |
| `file.delete` | Permanently delete files                                       | `propose`         |

### Web

| Capability    | Description                                                    | Default HITL Mode |
|---------------|----------------------------------------------------------------|-------------------|
| `web.search`  | Perform web searches via configured search provider            | `auto`            |
| `web.browse`  | Navigate web pages and extract content                         | `auto`            |
| `web.post`    | Submit forms or POST data to external web endpoints            | `notify`          |

### Calendar & Scheduling

| Capability        | Description                                              | Default HITL Mode |
|-------------------|----------------------------------------------------------|-------------------|
| `calendar.read`   | Read calendar events and availability                    | `auto`            |
| `calendar.write`  | Create, modify, or delete calendar events                | `propose`         |

### Code & Data

| Capability      | Description                                                  | Default HITL Mode |
|-----------------|--------------------------------------------------------------|-------------------|
| `code.execute`  | Execute code in a sandboxed environment                      | `notify`          |
| `data.query`    | Query connected databases (read-only)                        | `auto`            |
| `data.write`    | Write to connected databases                                 | `propose`         |

### Agent Operations

| Capability        | Description                                                | Default HITL Mode |
|-------------------|------------------------------------------------------------|-------------------|
| `agent.spawn`     | Spawn a new sub-agent with a subset of current capabilities| `notify`          |
| `agent.delegate`  | Delegate a task to another registered agent                | `notify`          |
| `agent.terminate` | Terminate a running agent session                          | `propose`         |

---

## High-Risk Capabilities

Two capabilities are **hardcoded as high-risk** and have special treatment that cannot be overridden by configuration:

| Capability         | Reason                                                          |
|--------------------|-----------------------------------------------------------------|
| `phone.call`       | Real-world irreversible action; potential for fraud/harassment  |
| `finance.transfer` | Financial transactions are irreversible and directly harmful    |

For these capabilities:

1. The HITL mode is **always** `escalate`, regardless of what is configured
2. Escalation targets the **organization admin** — not just the task owner
3. Even if HITL is globally disabled (not recommended), these capabilities are still blocked and escalated
4. They appear with a warning badge in the Storsko dashboard

```typescript
// packages/capability-registry — excerpt
export const HIGH_RISK_CAPABILITIES = ["phone.call", "finance.transfer"] as const;

export function isHighRisk(capability: string): boolean {
  return (HIGH_RISK_CAPABILITIES as readonly string[]).includes(capability);
}
```

::alert{type="danger" title="You cannot configure `phone.call` or `finance.transfer` to use `auto` mode. Attempts to do so via the API will return `422 Unprocessable Entity`. This is a deliberate safety property."}

::

---

## Granting Capabilities to Agents

Capabilities are granted when an agent is created or updated. Grants are stored in the database and reflected in the agent's JWT.

### At Creation Time

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "research-agent",
    "description": "Searches the web and reads files for research tasks",
    "capabilities": ["web.search", "web.browse", "file.read"],
    "risk_level": "minimal"
  }'
```

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ apiKey: process.env.STORSKO_ROOT_KEY });

const agent = await client.agents.create({
  name: "research-agent",
  description: "Searches the web and reads files for research tasks",
  capabilities: ["web.search", "web.browse", "file.read"],
  riskLevel: "minimal",
});
```

### Adding Capabilities to an Existing Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents/agt_01h9.../capabilities \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"capability": "email.send"}'
```

```typescript
await client.agents.grantCapability(agentId, "email.send");
```

### Revoking Capabilities

```bash
curl -X DELETE \
  http://localhost:3000/api/v1/agents/agt_01h9.../capabilities/email.send \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

```typescript
await client.agents.revokeCapability(agentId, "email.send");
```

::alert{type="info" title="Revoking a capability takes effect on the next JWT issuance. The current JWT remains valid until it expires. For immediate effect, also call the token invalidation endpoint: `POST /api/v1/agents/:id/invalidate-token`."}

::

### Listing an Agent's Capabilities

```bash
curl http://localhost:3000/api/v1/agents/agt_01h9.../capabilities \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

**Response:**

```json
{
  "agent_id": "agt_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "capabilities": [
    {
      "name": "web.search",
      "granted_at": "2024-03-01T10:00:00Z",
      "granted_by": "usr_01h9...",
      "hitl_mode": "auto"
    },
    {
      "name": "email.send",
      "granted_at": "2024-03-15T14:30:00Z",
      "granted_by": "usr_01h9...",
      "hitl_mode": "propose"
    }
  ]
}
```

---

## Capability Validation in the Execution Adapter

The `packages/execution-adapter` is the governance chokepoint where every execution request is validated. The flow is:

```
Agent sends: POST /api/v1/executions
  │
  ├─ 1. Validate agent JWT (signature + expiry)
  │
  ├─ 2. Extract capabilities[] from JWT claims
  │
  ├─ 3. Check requested capability is in JWT capabilities[]
  │        → if not: 403 Forbidden
  │
  ├─ 4. Check capability grant is active in DB (not revoked mid-session)
  │        → if revoked: 403 Forbidden
  │
  ├─ 5. Check agent status is "active"
  │        → if deactivated: 403 Forbidden
  │
  ├─ 6. Determine HITL mode for this capability
  │        → high-risk? force "escalate"
  │        → else: use configured hitl_mode for this agent+capability
  │
  ├─ 7. Apply HITL mode
  │        → auto: proceed immediately
  │        → propose/notify/escalate: create HITL request, wait/notify
  │        → block: reject with 403
  │
  ├─ 8. Execute capability
  │
  └─ 9. Write audit log entry (success or failure)
```

### Execution Request Format

```bash
curl -X POST http://localhost:3000/api/v1/executions \
  -H "Authorization: Bearer $AGENT_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "web.search",
    "input": {
      "query": "EU AI Act compliance checklist 2024"
    },
    "context": {
      "task_id": "task_01h9...",
      "session_id": "sess_01h9..."
    }
  }'
```

**Success response (auto mode):**

```json
{
  "execution_id": "exec_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "status": "completed",
  "capability": "web.search",
  "output": { "results": [...] },
  "audit_entry_id": "aud_01h9...",
  "hitl_mode": "auto"
}
```

**Pending response (propose mode):**

```json
{
  "execution_id": "exec_01h9...",
  "status": "pending_approval",
  "capability": "email.send",
  "hitl_request_id": "hitl_01h9...",
  "hitl_mode": "propose",
  "message": "Awaiting human approval before executing email.send"
}
```

---

## Configuring HITL Mode Per Capability

You can override the default HITL mode for a specific capability on a specific agent:

```bash
curl -X PATCH \
  http://localhost:3000/api/v1/agents/agt_01h9.../capabilities/email.send \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hitl_mode": "notify"}'
```

```typescript
await client.agents.updateCapabilityConfig(agentId, "email.send", {
  hitlMode: "notify",
});
```

::alert{type="warning" title="You cannot set `hitl_mode` to `auto` for `phone.call` or `finance.transfer`. These capabilities always use `escalate`. The API will reject this with `422 Unprocessable Entity`."}

::

---

## Custom Capabilities

Beyond the built-in capabilities, you can define custom capabilities in the capability registry for domain-specific actions:

```typescript
// Define a custom capability
await client.capabilities.define({
  name: "crm.update",
  description: "Update a CRM contact or opportunity",
  category: "crm",
  defaultHitlMode: "notify",
  isHighRisk: false,
  schema: {
    input: {
      type: "object",
      properties: {
        contact_id: { type: "string" },
        fields: { type: "object" },
      },
      required: ["contact_id", "fields"],
    },
  },
});
```

::alert{type="info" title="Custom capabilities follow the same grant, revoke, and HITL validation flow as built-in capabilities. They appear in the dashboard alongside built-in capabilities."}

::

---

## Capability Inheritance in Agent Delegation

When an agent delegates a task to another agent (`agent.delegate`), the target agent can only receive capabilities that the delegating agent already has. This prevents privilege escalation through delegation chains:

```
Agent A has: [web.search, file.read, email.send]
Agent A delegates to Agent B

Agent B can receive at most: [web.search, file.read, email.send]
Agent B CANNOT receive: [finance.transfer] (Agent A doesn't have it)
```

Similarly, when spawning a sub-agent (`agent.spawn`), the sub-agent's capability list must be a strict subset of the spawning agent's capabilities.

---

## API Reference Summary

| Method   | Endpoint                                              | Description                              |
|----------|-------------------------------------------------------|------------------------------------------|
| `GET`    | `/api/v1/agents/:id/capabilities`                     | List capabilities for an agent           |
| `POST`   | `/api/v1/agents/:id/capabilities`                     | Grant a capability to an agent           |
| `DELETE` | `/api/v1/agents/:id/capabilities/:capability`         | Revoke a capability from an agent        |
| `PATCH`  | `/api/v1/agents/:id/capabilities/:capability`         | Update HITL mode for a capability        |
| `GET`    | `/api/v1/capabilities`                                | List all defined capabilities            |
| `POST`   | `/api/v1/capabilities`                                | Define a custom capability               |
| `POST`   | `/api/v1/executions`                                  | Execute a capability (agent-auth only)   |

---

## Related Pages

- [Authentication](./authentication) — how agents prove their identity
- [Human-in-the-Loop](./hitl) — the approval workflow for capability executions
- [Audit Log](./audit-log) — every capability execution is recorded
- [Agents](./agents) — agent registration and capability assignment
- [Compliance](../guides/compliance) — EU AI Act risk classification
