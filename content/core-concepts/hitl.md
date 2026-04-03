---
title: "Human-in-the-Loop (HITL)"
description: "The five HITL modes, approval workflows, escalation chains, timeout behavior, and notification channels."
sidebar_order: 7
---

Human-in-the-Loop (HITL) is the mechanism by which Storsko inserts human oversight into AI agent actions. Rather than letting agents execute freely, HITL lets you define — per capability, per agent, per risk level — whether a human must approve, be notified, or can block execution entirely.

HITL is the core of Storsko's governance model. It is what separates an "AI agent with access to your systems" from an "AI agent operating under human supervision."

---

## Why HITL Matters

Modern AI agents are capable of taking actions with real-world consequences: sending emails, transferring money, deleting files, making phone calls. When things go wrong — hallucinations, prompt injections, runaway agents — the damage can be irreversible.

HITL gives organizations control levers between "agent runs freely" and "agent is completely disabled":

- **Visibility**: Know what agents are doing, even if you don't want to approve every action
- **Auditability**: Every HITL decision is recorded in the immutable audit log
- **Reversibility**: Stop actions before they happen, not after
- **Compliance**: EU AI Act and SOC2 require documented oversight for high-risk AI systems

---

## The Five HITL Modes

HITL mode is configured per capability per agent. The five modes represent a spectrum from full automation to full block.

### `auto` — Execute Immediately

The agent executes the capability without any human involvement. The action is still logged.

**Use when:** The capability is low-risk, reversible, or the agent has been thoroughly tested.

**Examples:** `web.search`, `file.read`, `calendar.read`, `data.query`

```
Agent → Execute → Audit Log
```

### `propose` — Present Plan, Wait for Approval

The agent presents what it intends to do and waits for a human to approve or reject before executing. The agent is blocked until a decision is made or the request times out.

**Use when:** The action has moderate consequences and you want a human review step.

**Examples:** `email.send`, `calendar.write`, `file.delete`, `data.write`

```
Agent → Create HITL Request (status: pending)
     → Human notified
     → Human approves or rejects
     → If approved: Execute → Audit Log
     → If rejected: Cancel → Audit Log
```

::alert{type="default" title="`propose` mode is the recommended default for any capability that sends messages, modifies data, or creates side effects outside your system."}

::

### `notify` — Execute But Notify

The agent executes immediately, but a notification is sent to the configured recipients. This provides visibility without blocking the agent.

**Use when:** You want to know what agents are doing without creating a bottleneck. Useful for medium-volume, low-criticality actions.

**Examples:** `file.write`, `web.post`, `code.execute`, `agent.spawn`

```
Agent → Execute → Notify humans → Audit Log
```

::alert{type="info" title="In `notify` mode, execution is not blocked. If you need to be able to stop the action, use `propose` instead."}

::

### `escalate` — Escalate to Org Admin

The agent's request is immediately escalated to the organization admin. The action does not execute until the admin explicitly approves it. This is the forced mode for all high-risk capabilities (`phone.call`, `finance.transfer`).

**Use when:** The action is high-risk, irreversible, or requires sign-off from someone with authority.

```
Agent → Create HITL Request (status: escalated)
     → Org admin notified (high-priority)
     → Admin approves or rejects
     → If approved: Execute → Audit Log
     → If rejected: Cancel → Audit Log (with admin notes)
```

::alert{type="danger" title="`escalate` mode is **mandatory and non-overridable** for `phone.call` and `finance.transfer`. You cannot configure these capabilities to use any other HITL mode."}

::

### `block` — Prevent Execution

The capability is completely blocked. The agent receives an immediate rejection. No HITL request is created; the block is just logged.

**Use when:** An agent should never be able to use this capability, but you want explicit documentation of the block rather than simply not granting it.

**Examples:** Blocking `finance.transfer` for a research agent even if the grant exists, blocking `code.execute` in production for untested agents.

```
Agent → Blocked → Audit Log (blocked)
```

---

## HITL Configuration

### Setting HITL Mode at Grant Time

```bash
curl -X POST http://localhost:3000/api/v1/agents/agt_01h9.../capabilities \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "capability": "email.send",
    "hitl_mode": "propose"
  }'
```

### Updating HITL Mode for an Existing Grant

```bash
curl -X PATCH \
  http://localhost:3000/api/v1/agents/agt_01h9.../capabilities/email.send \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"hitl_mode": "notify"}'
```

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ apiKey: process.env.STORSKO_ROOT_KEY });

await client.agents.updateCapabilityConfig("agt_01h9...", "email.send", {
  hitlMode: "notify",
});
```

### Default HITL Modes

If no HITL mode is specified when granting a capability, the default from the capability registry is used. See the [Capabilities](./capabilities) page for the defaults table.

---

## HITL Request Lifecycle

A HITL request is created whenever an agent attempts an action that requires human involvement (`propose`, `escalate`). The request has a lifecycle:

```
created → pending → approved → executed
                 ↘ rejected → cancelled
                 ↘ timed_out → (configurable action)
                 ↘ escalated → pending (at higher level)
```

### Request Object

```json
{
  "id": "hitl_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "agent_id": "agt_01h9...",
  "capability": "email.send",
  "hitl_mode": "propose",
  "status": "pending",
  "input": {
    "to": "ceo@acmecorp.com",
    "subject": "Q4 Budget Proposal",
    "body": "Please find attached..."
  },
  "context": {
    "task_id": "task_01h9...",
    "session_id": "sess_01h9..."
  },
  "created_at": "2024-03-15T10:00:00Z",
  "expires_at": "2024-03-15T10:30:00Z",
  "decision": null,
  "decided_by": null,
  "decided_at": null,
  "escalation_level": 0,
  "escalated_to": null
}
```

### Status Values

| Status       | Description                                                      |
|--------------|------------------------------------------------------------------|
| `pending`    | Waiting for human decision                                       |
| `approved`   | Human approved; agent will proceed with execution                |
| `rejected`   | Human rejected; execution cancelled                              |
| `timed_out`  | Decision window expired; timeout action applied                  |
| `escalated`  | Escalated to a higher authority; pending their decision          |
| `cancelled`  | Agent cancelled the request before a decision was made           |

---

## Approving and Rejecting HITL Requests

### Via Dashboard

Open the Storsko web app, navigate to **HITL Requests**, and approve or reject requests with an optional note.

### Via API

```bash
# Approve
curl -X POST http://localhost:3000/api/v1/hitl/hitl_01h9.../approve \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Looks good, approved for Q4 planning"}'

# Reject
curl -X POST http://localhost:3000/api/v1/hitl/hitl_01h9.../reject \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"note": "Do not send this without legal review"}'
```

```typescript
// Approve a HITL request
await client.hitl.approve("hitl_01h9...", {
  note: "Looks good, approved for Q4 planning",
});

// Reject a HITL request
await client.hitl.reject("hitl_01h9...", {
  note: "Do not send this without legal review",
});
```

### Listing Pending Requests

```bash
curl http://localhost:3000/api/v1/hitl?status=pending \
  -H "Authorization: Bearer $USER_TOKEN"
```

```typescript
const { requests } = await client.hitl.list({ status: "pending" });
```

---

## Escalation

Escalation moves a HITL request up the authority chain. An escalated request is removed from the original reviewer's queue and placed in the escalation target's queue.

### Escalation Levels

| Level | Target                    | Triggered By                                     |
|-------|---------------------------|--------------------------------------------------|
| 0     | Task owner / direct team  | Default for `propose` mode                       |
| 1     | Team lead / dept manager  | Manual escalation by reviewer, or near-timeout   |
| 2     | Org admin                 | Forced for `escalate` mode; second manual bump   |

The maximum escalation depth is **level 2** (org admin). If a request is at level 2 and the admin has not responded, the timeout action is applied.

### Escalating via API

```bash
curl -X POST http://localhost:3000/api/v1/hitl/hitl_01h9.../escalate \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "This request requires financial authorization above my approval level"
  }'
```

```typescript
await client.hitl.escalate("hitl_01h9...", {
  reason: "Requires financial authorization above my approval level",
});
```

### Escalation Response

```json
{
  "id": "hitl_01h9...",
  "status": "escalated",
  "escalation_level": 1,
  "escalated_to": "usr_admin_01h9...",
  "escalated_at": "2024-03-15T10:15:00Z",
  "escalation_reason": "Requires financial authorization above my approval level"
}
```

---

## Timeout Behavior

Every HITL request has an expiry window. If no decision is made before the window closes, the timeout action is applied.

### Default Timeout

The default timeout window is **30 minutes** for `propose` and `escalate` modes. This is configurable per capability.

### Timeout Actions

| Action        | Behavior                                                            |
|---------------|---------------------------------------------------------------------|
| `reject`      | Automatically reject the request (safest default)                  |
| `approve`     | Automatically approve (use only for low-risk, time-sensitive flows) |
| `escalate`    | Escalate to the next level before timing out                        |
| `notify_only` | Mark as timed out but take no execution action                      |

The default timeout action is `reject`. Configure per capability:

```bash
curl -X PATCH \
  http://localhost:3000/api/v1/agents/agt_01h9.../capabilities/email.send \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "hitl_timeout_seconds": 1800,
    "hitl_timeout_action": "escalate"
  }'
```

### Triggering Timeout Manually

For testing or operational purposes, you can manually trigger the timeout logic on a specific request:

```bash
curl -X POST http://localhost:3000/api/v1/hitl/hitl_01h9.../timeout \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

::alert{type="warning" title="Manual timeout is an admin-only operation. It triggers the configured timeout action immediately, regardless of how much time remains."}

::

---

## Notification Channels

When a HITL request is created or escalated, Storsko sends notifications through configured channels.

### Supported Channels

| Channel        | Configuration                                                |
|----------------|--------------------------------------------------------------|
| Email          | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`           |
| Slack          | `SLACK_WEBHOOK_URL` or Slack App OAuth token                 |
| Microsoft Teams| `TEAMS_WEBHOOK_URL`                                          |
| In-app         | Always active — shown in the Storsko dashboard               |
| Webhook        | `HITL_WEBHOOK_URL` — generic HTTP POST for custom integrations |

### Notification Payload (Webhook)

```json
{
  "event": "hitl.request.created",
  "hitl_request_id": "hitl_01h9...",
  "agent_id": "agt_01h9...",
  "agent_name": "email-agent",
  "capability": "email.send",
  "hitl_mode": "propose",
  "input_summary": "Send email to ceo@acmecorp.com: Q4 Budget Proposal",
  "approve_url": "https://app.storsko.io/hitl/hitl_01h9.../approve",
  "reject_url": "https://app.storsko.io/hitl/hitl_01h9.../reject",
  "expires_at": "2024-03-15T10:30:00Z"
}
```

### Slack Notification Example

When configured, Storsko sends interactive Slack messages with Approve/Reject buttons that call back to the API, so reviewers can act directly from Slack without opening the dashboard.

---

## Integration with the Audit Log

Every HITL event is recorded in the audit log:

| Event                     | Logged Data                                                  |
|---------------------------|--------------------------------------------------------------|
| HITL request created      | Agent, capability, input, mode, expiry                       |
| HITL request approved     | Approver user ID, timestamp, note                            |
| HITL request rejected     | Rejector user ID, timestamp, note                            |
| HITL request timed out    | Timeout action taken, timestamp                              |
| HITL request escalated    | Escalation reason, new target, new level                     |
| Execution after approval  | Execution ID, output summary, duration                       |

The audit trail provides a complete picture of every human decision in the system. See [Audit Log](./audit-log) for full details on the log structure and query API.

---

## Full HITL API Reference

| Method   | Endpoint                            | Description                              |
|----------|-------------------------------------|------------------------------------------|
| `GET`    | `/api/v1/hitl`                      | List HITL requests (filterable by status)|
| `GET`    | `/api/v1/hitl/:id`                  | Get a specific HITL request              |
| `POST`   | `/api/v1/hitl/:id/approve`          | Approve a HITL request                   |
| `POST`   | `/api/v1/hitl/:id/reject`           | Reject a HITL request                    |
| `POST`   | `/api/v1/hitl/:id/escalate`         | Escalate a HITL request                  |
| `POST`   | `/api/v1/hitl/:id/timeout`          | Manually trigger timeout (admin only)    |
| `GET`    | `/api/v1/hitl/stats`                | HITL approval rate, avg decision time    |

---

## Code Examples

### Polling for a HITL Decision

After submitting an execution that enters `propose` mode, poll for the decision:

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ token: process.env.AGENT_JWT });

// Submit execution
const execution = await client.executions.run({
  capability: "email.send",
  input: { to: "boss@acmecorp.com", subject: "Report", body: "..." },
});

if (execution.status === "pending_approval") {
  // Poll every 10 seconds
  let decision: string | null = null;
  while (!decision) {
    await new Promise((r) => setTimeout(r, 10_000));
    const hitl = await client.hitl.get(execution.hitlRequestId);
    if (hitl.status === "approved") {
      decision = "approved";
      console.log("Approved! Execution proceeding.");
    } else if (hitl.status === "rejected") {
      decision = "rejected";
      console.log("Rejected:", hitl.decision?.note);
    }
  }
}
```

### Webhook Handler for HITL Events

```typescript
import Fastify from "fastify";

const app = Fastify();

app.post("/webhooks/storsko-hitl", async (req, reply) => {
  const event = req.body as {
    event: string;
    hitl_request_id: string;
    capability: string;
    input_summary: string;
  };

  if (event.event === "hitl.request.created") {
    console.log(`HITL request for ${event.capability}: ${event.input_summary}`);
    // Send custom notification, log to Datadog, etc.
  }

  reply.send({ ok: true });
});
```

---

## Related Pages

- [Capabilities](./capabilities) — per-capability HITL mode configuration
- [Audit Log](./audit-log) — HITL decisions are permanently recorded
- [Agents](./agents) — agent risk levels influence HITL defaults
- [Compliance](../guides/compliance) — HITL satisfies EU AI Act oversight requirements
