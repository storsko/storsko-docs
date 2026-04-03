---
title: "Task Routing"
description: "How the task router assigns work to agents based on capabilities, ownership, and node freshness."
sidebar_order: 10
icon: "lucide:compass"
navigation: true
---

Storsko's task router assigns incoming work to the most appropriate agent based on capabilities, ownership, and node freshness.

## How routing works

When `POST /api/v1/routing/resolve` is called, the router:

1. Filters agents by **required capabilities** — only agents with all requested grants are considered.
2. Scores by **ownership type** — `personal` > `team` > `org` (personal ownership scores highest).
3. Prefers **fresh nodes** — agents with a recent `node_last_seen` heartbeat rank higher.
4. Returns the best match, or a `404` if no eligible agent exists.

## Request

```http
POST /api/v1/routing/resolve
Authorization: Bearer <root-api-key>
Content-Type: application/json

{
  "capabilities": ["web.search", "finance.read"],
  "ownership_type": "team",
  "team_id": "team_abc123"
}
```

## Response

```json
{
  "agent_id": "agent_xyz",
  "agent_name": "Research Bot",
  "score": 0.92,
  "ownership_type": "team"
}
```

## Routing log

All routing decisions are recorded:

```http
GET /api/v1/routing/log
```

Returns the last 200 decisions with agent, capabilities requested, score, and timestamp.

## Delegation

An agent with the `agent.delegate` capability can forward a task to another agent (max depth 3):

```http
POST /api/v1/routing/delegate
Authorization: Bearer <agent-jwt>
Content-Type: application/json

{
  "task_id": "task_123",
  "target_agent_id": "agent_456",
  "reason": "Specialist required"
}
```

Delegation chains are stored in `delegation_log` and visible in the audit trail.
