---
title: "Agents"
description: "Agent registration, EU AI Act risk levels, lifecycle management, and the Node protocol."
sidebar_order: 9
---

An agent in Storsko is any autonomous AI process that executes capabilities on behalf of an organization. Agents are the primary subjects of governance: they have defined capabilities, assigned risk levels, and a full lifecycle from registration to deactivation.

Storsko supports two categories of agents:

- **External agents** — registered via the REST API; can be any process that speaks HTTP
- **Storsko Node agents** — registered and managed via the Node protocol; use the Storsko Node SDK for deeper integration

---

## Agent Fields

Every agent record contains the following fields:

| Field             | Type       | Description                                                    |
|-------------------|------------|----------------------------------------------------------------|
| `id`              | `string`   | UUID prefixed with `agt_`                                      |
| `name`            | `string`   | Human-readable name for the agent                              |
| `description`     | `string`   | What the agent does                                            |
| `capabilities`    | `string[]` | List of granted capability names                               |
| `risk_level`      | `string`   | EU AI Act risk level: `minimal`, `limited`, `high`, `unacceptable` |
| `owner_org_id`    | `string`   | UUID of the owning organization                                |
| `owner_user_id`   | `string`   | UUID of the user who registered the agent                      |
| `status`          | `string`   | `active` or `inactive`                                         |
| `node_last_seen`  | `string`   | ISO timestamp of last Node protocol heartbeat (null for HTTP agents) |
| `created_at`      | `string`   | ISO timestamp of registration                                  |
| `updated_at`      | `string`   | ISO timestamp of last modification                             |

**Example agent record:**

```json
{
  "id": "agt_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "name": "research-agent",
  "description": "Searches the web and summarizes research papers",
  "capabilities": ["web.search", "web.browse", "file.read"],
  "risk_level": "minimal",
  "owner_org_id": "org_01h9...",
  "owner_user_id": "usr_01h9...",
  "status": "active",
  "node_last_seen": null,
  "created_at": "2024-03-01T09:00:00Z",
  "updated_at": "2024-03-01T09:00:00Z"
}
```

---

## Registering an Agent

### Via REST API (External Agents)

Any process can register as an agent by POSTing to `/api/v1/agents` with a root API key or admin user token:

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "invoice-processor",
    "description": "Reads invoices from S3 and posts them to the ERP system",
    "capabilities": ["file.read", "data.write"],
    "risk_level": "limited"
  }'
```

**Response:**

```json
{
  "agent": {
    "id": "agt_01h9k2m3n4p5q6r7s8t9u0v1w2",
    "name": "invoice-processor",
    "capabilities": ["file.read", "data.write"],
    "risk_level": "limited",
    "status": "active",
    ...
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

The `token` in the response is the agent's JWT. Store this securely — it is used for all subsequent capability execution requests.

### Via TypeScript SDK

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ apiKey: process.env.STORSKO_ROOT_KEY });

const { agent, token } = await client.agents.create({
  name: "invoice-processor",
  description: "Reads invoices from S3 and posts them to the ERP system",
  capabilities: ["file.read", "data.write"],
  riskLevel: "limited",
});

console.log("Agent ID:", agent.id);
console.log("Agent JWT:", token);
```

### Via Node Protocol (Storsko Node Agents)

Storsko Node agents register themselves using the Node SDK, which handles authentication, heartbeats, and capability negotiation automatically:

```typescript
import { StorskoNode } from "@storsko/node";

const node = new StorskoNode({
  baseUrl: process.env.STORSKO_BASE_URL,
  agentName: "my-node-agent",
  capabilities: ["web.search", "code.execute"],
  riskLevel: "limited",
  // Node protocol handles registration + heartbeat
});

await node.connect();

node.on("execute", async ({ capability, input, context }) => {
  if (capability === "web.search") {
    const results = await performSearch(input.query);
    return { results };
  }
});
```

---

## EU AI Act Risk Levels

Every agent must have a `risk_level` that classifies it under the EU AI Act risk framework. This affects HITL defaults, audit requirements, and compliance reporting.

### Risk Level Definitions

| Level          | Description                                                           | Examples                                    |
|----------------|-----------------------------------------------------------------------|---------------------------------------------|
| `minimal`      | No significant risk to safety, rights, or society                     | Web search, file reader, calendar viewer    |
| `limited`      | Some interaction with humans; transparency obligations apply          | Email sender, report generator              |
| `high`         | High risk to safety or fundamental rights; strict obligations apply   | Medical decision support, credit scoring    |
| `unacceptable` | Prohibited under EU AI Act; must not be deployed                      | Social scoring, manipulative techniques     |

::alert{type="danger" title="Agents with `risk_level: "unacceptable"` will be blocked from executing any capabilities. This risk level exists to document why a system was not deployed. You cannot grant capabilities to an unacceptable-risk agent."}

::

### High-Risk Agent Behavior

Agents with `risk_level: "high"` have additional automatic governance applied:

1. All capability executions are logged with extended metadata
2. Default HITL mode for all capabilities is upgraded to at minimum `notify` (even if `auto` is configured)
3. They appear with a warning badge in the dashboard
4. Compliance reports include a dedicated section for high-risk agents

### Setting or Updating Risk Level

```bash
curl -X PATCH http://localhost:3000/api/v1/agents/agt_01h9.../risk-level \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"risk_level": "high", "justification": "Processes patient medical records"}'
```

```typescript
await client.agents.setRiskLevel(agentId, "high", {
  justification: "Processes patient medical records",
});
```

Risk level changes are logged as `agent.updated` events in the audit log with the old and new values.

---

## Agent Lifecycle

### Active

The default state after registration. The agent can authenticate, receive JWTs, and execute capabilities.

### Deactivated

An admin deactivates an agent to stop it from executing capabilities without deleting its history:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agt_01h9.../deactivate \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "Agent retired after project completion"}'
```

When deactivated:
- The agent's current JWT is invalidated immediately
- Token refresh requests return `403 Forbidden`
- Execution attempts return `403 Forbidden`
- The agent record is retained (audit log entries remain intact)
- The deactivation is logged as `agent.deactivated`

### Reactivating an Agent

```bash
curl -X POST http://localhost:3000/api/v1/agents/agt_01h9.../activate \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

### Transferring an Agent

Agents can be transferred between organizations. This is useful when an external vendor builds an agent and transfers governance responsibility to the client:

```bash
curl -X POST http://localhost:3000/api/v1/agents/agt_01h9.../transfer \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "new_org_id": "org_01h9...",
    "reason": "Client taking over governance after handover"
  }'
```

The transfer:
- Changes `owner_org_id` to the new organization
- Revokes the current JWT (new org issues its own tokens)
- Logs an `agent.transferred` event with old and new org IDs

::alert{type="warning" title="The receiving organization must explicitly accept the transfer. Storsko sends a transfer request notification to the new org's admin. The transfer takes effect when the admin accepts it via `POST /api/v1/agents/:id/transfer/accept`."}

::

---

## Node Protocol

The Node protocol is a persistent connection protocol for agents that need to maintain state, receive push notifications (e.g., HITL approvals), or report their availability via heartbeat.

### Connection Flow

```
1. Agent calls POST /api/v1/agents/node/connect with credentials
2. Server returns WebSocket URL + session token
3. Agent opens WebSocket connection
4. Server sends "connected" message with agent config
5. Agent sends periodic heartbeats (default: every 30 seconds)
6. Server pushes HITL requests to agent via WebSocket
7. Agent processes requests and sends results back
```

### Heartbeat Mechanism

Node agents send a heartbeat message every 30 seconds. The server updates `node_last_seen` on each heartbeat. This field is used by the task router to assess agent freshness:

- **Last seen < 60s**: Agent is considered live
- **Last seen 60s–5m**: Agent is considered degraded
- **Last seen > 5m**: Agent is considered offline; task router will not route to it

```typescript
// Node SDK handles heartbeats automatically
const node = new StorskoNode({ ... });
await node.connect();
// Heartbeats are sent automatically every 30 seconds
```

If you're implementing the Node protocol manually:

```json
// Heartbeat message (client → server)
{
  "type": "heartbeat",
  "agent_id": "agt_01h9...",
  "timestamp": "2024-03-15T10:00:30Z",
  "status": "ready",
  "active_executions": 2
}

// Heartbeat ack (server → client)
{
  "type": "heartbeat_ack",
  "server_time": "2024-03-15T10:00:30.050Z"
}
```

---

## Listing and Querying Agents

```bash
# List all agents
curl http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Filter by status
curl "http://localhost:3000/api/v1/agents?status=active" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Filter by risk level
curl "http://localhost:3000/api/v1/agents?risk_level=high" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Get a specific agent
curl http://localhost:3000/api/v1/agents/agt_01h9... \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

```typescript
// List all active high-risk agents
const { agents } = await client.agents.list({
  status: "active",
  riskLevel: "high",
});

agents.forEach((agent) => {
  console.log(
    `${agent.name} (${agent.id}) — last seen: ${agent.nodeLastSeen ?? "HTTP agent"}`
  );
});
```

---

## API Reference

| Method   | Endpoint                                    | Description                              |
|----------|---------------------------------------------|------------------------------------------|
| `GET`    | `/api/v1/agents`                            | List agents (filterable)                 |
| `POST`   | `/api/v1/agents`                            | Register a new agent                     |
| `GET`    | `/api/v1/agents/:id`                        | Get agent details                        |
| `PATCH`  | `/api/v1/agents/:id`                        | Update agent name/description            |
| `POST`   | `/api/v1/agents/:id/activate`               | Reactivate a deactivated agent           |
| `POST`   | `/api/v1/agents/:id/deactivate`             | Deactivate an agent                      |
| `POST`   | `/api/v1/agents/:id/transfer`               | Initiate agent transfer to new org       |
| `POST`   | `/api/v1/agents/:id/transfer/accept`        | Accept an incoming agent transfer        |
| `PATCH`  | `/api/v1/agents/:id/risk-level`             | Update agent risk level                  |
| `POST`   | `/api/v1/agents/:id/invalidate-token`       | Invalidate current agent JWT             |
| `GET`    | `/api/v1/agents/:id/capabilities`           | List agent capabilities                  |
| `POST`   | `/api/v1/agents/:id/capabilities`           | Grant capability to agent                |
| `DELETE` | `/api/v1/agents/:id/capabilities/:cap`      | Revoke capability from agent             |
| `POST`   | `/api/v1/agents/node/connect`               | Initiate Node protocol connection        |

---

## Related Pages

- [Authentication](./authentication) — agent JWT issuance and usage
- [Capabilities](./capabilities) — what agents are allowed to do
- [Human-in-the-Loop](./hitl) — oversight for agent actions
- [Task Routing](../guides/routing) — how tasks are assigned to agents
- [Compliance](../guides/compliance) — EU AI Act risk level requirements
