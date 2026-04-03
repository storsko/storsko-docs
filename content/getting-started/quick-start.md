---
title: "Quick Start"
description: "Register an agent, grant capabilities, trigger a HITL request, and view the audit log in 15 minutes."
sidebar_order: 3
---

This guide walks you through the core Storsko workflow end to end. By the end you will have:

1. Registered an agent
2. Granted it capabilities
3. Made a governed execution that triggers a HITL request
4. Approved the request
5. Viewed the audit log

**Estimated time:** 15 minutes

---

## Prerequisites

- Storsko is running locally (see [Installation](./))
- You have your root API key from `make setup`
- `curl` is available in your terminal (or use the [SDK](#using-the-sdk) examples)

Throughout this guide, replace `YOUR_ROOT_API_KEY` with your actual root API key (e.g. `storsko_root_abc123...`).

::alert{type="default" title="API Base URL"}
All examples in this guide use `http://localhost:3000/api/v1` as the base URL. If you changed the port, update accordingly.
::

---

## Step 1: Register Your First Agent

An agent in Storsko represents an autonomous process that will perform actions on your behalf. Before an agent can do anything, it must be registered in the governance registry.

### Using curl

```bash
curl -X POST http://localhost:3000/api/v1/agents \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "name": "Data Pipeline Agent",
    "description": "Reads from S3, transforms data, writes results to PostgreSQL.",
    "riskLevel": "limited"
  }'
```

Response:

```json
{
  "agent": {
    "id": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
    "name": "Data Pipeline Agent",
    "description": "Reads from S3, transforms data, writes results to PostgreSQL.",
    "riskLevel": "limited",
    "status": "active",
    "capabilities": [],
    "createdAt": "2026-03-30T12:00:00.000Z",
    "updatedAt": "2026-03-30T12:00:00.000Z"
  }
}
```

Save the `id` — you will use it throughout this guide. In the examples below, the agent ID is `agt_01j8x4k2m3n5p6q7r8s9t0uvwx`.

### Using the SDK

```typescript
import { StorSkoClient } from '@storsko/sdk';

const client = new StorSkoClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'YOUR_ROOT_API_KEY',
});

const { agent } = await client.agents.create({
  name: 'Data Pipeline Agent',
  description: 'Reads from S3, transforms data, writes results to PostgreSQL.',
  riskLevel: 'limited',
});

console.log('Agent registered:', agent.id);
```

### Verify the Agent Was Registered

```bash
curl -H "x-api-key: YOUR_ROOT_API_KEY" \
  http://localhost:3000/api/v1/agents
```

```json
{
  "agents": [
    {
      "id": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "name": "Data Pipeline Agent",
      "status": "active",
      "riskLevel": "limited",
      "capabilities": []
    }
  ],
  "total": 1
}
```

---

## Step 2: Grant Capabilities

Capabilities define what an agent is allowed to do. An agent with no capabilities cannot take any actions. Storsko enforces this at the `execution-adapter` chokepoint.

### List Available Capabilities

First, see what capabilities are defined in your registry:

```bash
curl -H "x-api-key: YOUR_ROOT_API_KEY" \
  http://localhost:3000/api/v1/capabilities
```

```json
{
  "capabilities": [
    { "id": "file:read", "description": "Read files from the filesystem or object storage" },
    { "id": "file:write", "description": "Write files to the filesystem or object storage" },
    { "id": "db:read", "description": "Execute read-only database queries" },
    { "id": "db:mutate", "description": "Execute INSERT, UPDATE, DELETE queries" },
    { "id": "api:call", "description": "Make outbound HTTP requests" },
    { "id": "email:send", "description": "Send emails via SMTP or API" },
    { "id": "llm:invoke", "description": "Call LLM providers via the gateway" }
  ]
}
```

### Grant Capabilities to the Agent

Grant the agent the capabilities it needs. The `hitlMode` field controls when human approval is required:

- `never` — the action is always allowed without approval
- `always` — every use of this capability requires human approval
- `on_risk` — approval is required only when the agent's risk level is `high` or above

```bash
# Grant file:read — no approval required
curl -X POST http://localhost:3000/api/v1/capabilities/grant \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
    "capability": "file:read",
    "hitlMode": "never"
  }'
```

```bash
# Grant db:mutate — always requires human approval
curl -X POST http://localhost:3000/api/v1/capabilities/grant \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
    "capability": "db:mutate",
    "hitlMode": "always"
  }'
```

Response for each grant:

```json
{
  "grant": {
    "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
    "capability": "db:mutate",
    "hitlMode": "always",
    "grantedAt": "2026-03-30T12:01:00.000Z",
    "grantedBy": "root"
  }
}
```

### Using the SDK

```typescript
// Grant file:read
await client.capabilities.grant({
  agentId: agent.id,
  capability: 'file:read',
  hitlMode: 'never',
});

// Grant db:mutate with mandatory HITL
await client.capabilities.grant({
  agentId: agent.id,
  capability: 'db:mutate',
  hitlMode: 'always',
});

console.log('Capabilities granted');
```

---

## Step 3: Make a Governed Execution

The `@storsko/execution-adapter` package is the governance chokepoint. All agent actions should flow through it. Here is how it works in practice.

### Installing the Execution Adapter

If you are writing agent code in a separate project, install the adapter:

```bash
npm install @storsko/execution-adapter
# or
pnpm add @storsko/execution-adapter
```

### Using the Execution Adapter

```typescript
import { ExecutionAdapter } from '@storsko/execution-adapter';

const adapter = new ExecutionAdapter({
  apiUrl: 'http://localhost:3000',
  apiKey: 'YOUR_ROOT_API_KEY',
  agentId: 'agt_01j8x4k2m3n5p6q7r8s9t0uvwx',
});

// This will succeed immediately (hitlMode: "never")
const readResult = await adapter.execute({
  capability: 'file:read',
  action: 'readFile',
  payload: { path: '/data/input.csv' },
});

console.log('Read result:', readResult);
// { status: "approved", executionId: "exec_...", result: { ... } }

// This will pause and create a HITL request (hitlMode: "always")
try {
  const mutateResult = await adapter.execute({
    capability: 'db:mutate',
    action: 'insertRows',
    payload: {
      table: 'processed_data',
      rows: [{ id: 1, value: 'hello' }],
    },
    // Optional: block until approved or timeout
    waitForApproval: true,
    waitTimeoutMs: 60_000,
  });

  console.log('Mutation result:', mutateResult);
} catch (err) {
  if (err.code === 'HITL_PENDING') {
    console.log('Waiting for human approval. HITL ID:', err.hitlId);
  } else if (err.code === 'HITL_REJECTED') {
    console.log('Action was rejected by reviewer');
  } else if (err.code === 'CAPABILITY_NOT_GRANTED') {
    console.log('Agent does not have this capability');
  }
}
```

### What Happens Internally

When `adapter.execute()` is called with a capability that has `hitlMode: "always"`:

1. The adapter calls `POST /api/v1/hitl` to create a pending HITL request
2. The request is visible in the HITL queue (web dashboard and REST API)
3. If `waitForApproval: true`, the adapter polls for the decision
4. Once a reviewer approves or rejects, the adapter returns or throws accordingly
5. The decision is recorded in the audit log regardless of outcome

---

## Step 4: View the HITL Queue

After the execution adapter created a HITL request, you can view it in the queue.

### Using curl

```bash
curl -H "x-api-key: YOUR_ROOT_API_KEY" \
  http://localhost:3000/api/v1/hitl
```

```json
{
  "requests": [
    {
      "id": "hitl_01j8x4k2m3n5p6q7r8s9t0abcd",
      "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "agentName": "Data Pipeline Agent",
      "capability": "db:mutate",
      "action": "insertRows",
      "payload": {
        "table": "processed_data",
        "rows": [{ "id": 1, "value": "hello" }]
      },
      "status": "pending",
      "createdAt": "2026-03-30T12:02:00.000Z",
      "expiresAt": "2026-03-30T12:32:00.000Z"
    }
  ],
  "total": 1
}
```

### Using the SDK

```typescript
const { requests } = await client.hitl.list();
console.log('Pending HITL requests:', requests.length);

const pending = requests.filter(r => r.status === 'pending');
console.log('Pending:', pending[0]);
```

### Viewing in the Web Dashboard

Navigate to [http://localhost:3001](http://localhost:3001) and log in. The HITL queue is visible under **Governance → HITL Queue**. Pending requests appear with the agent name, capability, action, and payload for review.

---

## Step 5: Approve the HITL Request

A reviewer approves the request, optionally adding a comment explaining the decision.

### Using curl

```bash
curl -X POST \
  http://localhost:3000/api/v1/hitl/hitl_01j8x4k2m3n5p6q7r8s9t0abcd/approve \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "comment": "Reviewed the payload — inserting a single test row is acceptable."
  }'
```

Response:

```json
{
  "request": {
    "id": "hitl_01j8x4k2m3n5p6q7r8s9t0abcd",
    "status": "approved",
    "approvedBy": "root",
    "approvedAt": "2026-03-30T12:03:00.000Z",
    "comment": "Reviewed the payload — inserting a single test row is acceptable."
  }
}
```

### Rejecting a Request

If the request looks suspicious or incorrect, reject it instead:

```bash
curl -X POST \
  http://localhost:3000/api/v1/hitl/hitl_01j8x4k2m3n5p6q7r8s9t0abcd/reject \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "reason": "The target table is in production. This should go through the staging pipeline."
  }'
```

### Escalating a Request

If you are not sure, escalate to a senior reviewer:

```bash
curl -X POST \
  http://localhost:3000/api/v1/hitl/hitl_01j8x4k2m3n5p6q7r8s9t0abcd/escalate \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_ROOT_API_KEY" \
  -d '{
    "escalateTo": "senior-reviewer@example.com",
    "reason": "Unusual payload structure — needs data team review."
  }'
```

### Using the SDK

```typescript
const hitlId = 'hitl_01j8x4k2m3n5p6q7r8s9t0abcd';

// Approve
await client.hitl.approve(hitlId, {
  comment: 'Reviewed — looks correct.',
});

// Or reject
await client.hitl.reject(hitlId, {
  reason: 'Targeting wrong table.',
});
```

---

## Step 6: View the Audit Log

Every action — registration, capability grant, HITL decision, execution — is recorded in the audit log. The audit log is append-only and cannot be modified.

### Using curl

```bash
curl -H "x-api-key: YOUR_ROOT_API_KEY" \
  http://localhost:3000/api/v1/audit
```

```json
{
  "entries": [
    {
      "id": "audit_01j8x4k2m3n5p6q7r8s9t0aaaa",
      "event": "agent.registered",
      "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "actorId": "root",
      "metadata": { "name": "Data Pipeline Agent", "riskLevel": "limited" },
      "timestamp": "2026-03-30T12:00:00.000Z"
    },
    {
      "id": "audit_01j8x4k2m3n5p6q7r8s9t0bbbb",
      "event": "capability.granted",
      "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "actorId": "root",
      "metadata": { "capability": "db:mutate", "hitlMode": "always" },
      "timestamp": "2026-03-30T12:01:00.000Z"
    },
    {
      "id": "audit_01j8x4k2m3n5p6q7r8s9t0cccc",
      "event": "hitl.created",
      "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "actorId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "metadata": { "hitlId": "hitl_01j8x4k2m3n5p6q7r8s9t0abcd", "capability": "db:mutate" },
      "timestamp": "2026-03-30T12:02:00.000Z"
    },
    {
      "id": "audit_01j8x4k2m3n5p6q7r8s9t0dddd",
      "event": "hitl.approved",
      "agentId": "agt_01j8x4k2m3n5p6q7r8s9t0uvwx",
      "actorId": "root",
      "metadata": {
        "hitlId": "hitl_01j8x4k2m3n5p6q7r8s9t0abcd",
        "comment": "Reviewed the payload — inserting a single test row is acceptable."
      },
      "timestamp": "2026-03-30T12:03:00.000Z"
    }
  ],
  "total": 4
}
```

Every HITL approval includes the reviewer's identity, timestamp, and comment. This creates a complete chain of custody for every agent action.

### Filtering the Audit Log

You can filter audit log entries by agent, event type, or date range using query parameters:

```bash
# Filter by agent
curl "http://localhost:3000/api/v1/audit?agentId=agt_01j8x4k2m3n5p6q7r8s9t0uvwx" \
  -H "x-api-key: YOUR_ROOT_API_KEY"

# Filter by event type
curl "http://localhost:3000/api/v1/audit?event=hitl.approved" \
  -H "x-api-key: YOUR_ROOT_API_KEY"

# Filter by date range
curl "http://localhost:3000/api/v1/audit?from=2026-03-30T00:00:00Z&to=2026-03-30T23:59:59Z" \
  -H "x-api-key: YOUR_ROOT_API_KEY"
```

---

## What You Have Built

In this quick start you:

- Registered an agent with a risk level (`limited`)
- Granted it two capabilities: `file:read` (no approval) and `db:mutate` (always requires approval)
- Triggered a governed execution that created a HITL request
- Approved the request with a comment
- Verified the full chain of events in the audit log

This is the core Storsko workflow. From here you can:

- [Configure HITL timeout and escalation policies](../architecture/)
- [Set up teams and delegation](../api-reference/#teams)
- [Configure task routing](../api-reference/#routing)
- [Integrate the LLM gateway](../api-reference/#llm-gateway)
- [Set up Slack/Teams notifications](../commercial/) (Teams tier)

---

## Next Steps

- [Configuration](./configuration/) — environment variable reference
- [Architecture Overview](../architecture/) — understand the chokepoint pattern
- [REST API Reference](../api-reference/) — full endpoint reference
- [SDK Overview](../sdk/) — TypeScript client reference
