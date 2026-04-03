---
title: "REST API Reference"
description: "Complete endpoint reference for the Storsko Core REST API — agents, capabilities, execution, HITL, audit, teams, routing, and more."
sidebar_order: 13
icon: "lucide:code"
---

All endpoints are served by `api-server` (default port `3000`). Authenticate with your root API key unless noted.

## Authentication

```
Authorization: Bearer storsko_root_<64-hex-chars>
```

Agent JWTs (`Authorization: Bearer <jwt>`) are accepted on routes that accept agent-scoped tokens.

---

## Agents

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/agents` | List all registered agents |
| `POST` | `/api/v1/agents` | Register a new agent |
| `GET` | `/api/v1/agents/:id` | Get agent details |
| `PATCH` | `/api/v1/agents/:id` | Update agent metadata |
| `DELETE` | `/api/v1/agents/:id` | Remove an agent |
| `POST` | `/api/v1/agents/:id/transfer` | Transfer agent to another org |
| `POST` | `/api/v1/agents/:id/deactivate` | Deactivate agent |
| `PATCH` | `/api/v1/agents/:id/risk-level` | Set EU AI Act risk level |

## Capabilities

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/capabilities` | List all capability definitions |
| `POST` | `/api/v1/capabilities/grant` | Grant a capability to an agent |
| `DELETE` | `/api/v1/capabilities/grant/:id` | Revoke a capability grant |

## Execution

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/execute` | Execute a governed agent action |

## HITL

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/hitl` | List pending HITL requests |
| `GET` | `/api/v1/hitl/:id` | Get a HITL request |
| `POST` | `/api/v1/hitl/:id/approve` | Approve a HITL request |
| `POST` | `/api/v1/hitl/:id/reject` | Reject a HITL request |
| `POST` | `/api/v1/hitl/:id/escalate` | Escalate to org admin |
| `POST` | `/api/v1/hitl/:id/timeout` | Mark request as timed out |
| `GET` | `/api/v1/hitl/check-timeouts` | Trigger timeout sweep |

## Audit

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/audit` | Query audit log |
| `GET` | `/api/v1/audit/:user_id/export` | GDPR data export |

## Teams

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/teams` | List teams |
| `POST` | `/api/v1/teams` | Create a team |
| `GET` | `/api/v1/teams/:id` | Get team |
| `PATCH` | `/api/v1/teams/:id` | Update team |
| `DELETE` | `/api/v1/teams/:id` | Delete team |
| `POST` | `/api/v1/teams/:id/members` | Add member |
| `DELETE` | `/api/v1/teams/:id/members/:userId` | Remove member |

## Routing

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/routing/resolve` | Resolve best agent for a task |
| `GET` | `/api/v1/routing/log` | Last 200 routing decisions |
| `POST` | `/api/v1/routing/delegate` | Delegate task to another agent |

## Compliance

| Method | Path | Description |
|--------|------|-------------|
| `DELETE` | `/api/v1/users/:id/data` | GDPR erasure |

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| `PUT` | `/api/v1/notifications/config/:channel` | Configure notification channel |
| `GET` | `/api/v1/notifications/config/:channel` | Get channel config |
| `DELETE` | `/api/v1/notifications/config/:channel` | Remove channel config |

## Health

```http
GET /health
```

Returns `{ status: "ok" }` when the API server is up.
