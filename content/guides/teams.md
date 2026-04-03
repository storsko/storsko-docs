---
title: "Teams"
description: "Team management for shared governance, HITL routing, and capability administration."
sidebar_order: 18
---

Teams are organizational units within Storsko that group users and agents together for shared governance, routing, and capability management. Teams are especially useful in `teams` and `enterprise` tier deployments where multiple people need to collaborate on agent oversight and task management.

::alert{type="info" title="Teams are a commercial feature available on the `teams` and `enterprise` tiers. OSS deployments operate with a single implicit organization and do not have the teams layer."}

::

---

## When to Use Teams

Use teams when:

- Multiple people share oversight responsibility for a set of agents
- You want to route certain tasks to a specific group of agents (e.g., "route all finance tasks to the finance team's agents")
- You need scoped HITL — only team members should approve requests from their team's agents
- You want to manage capability grants at the team level rather than per-agent

**Example team structures:**

| Team              | Members                              | Agents                                          |
|-------------------|--------------------------------------|-------------------------------------------------|
| `finance-ops`     | CFO, finance managers                | invoice-processor, payment-agent                |
| `customer-success`| CS leads, support engineers          | email-responder, ticket-classifier              |
| `engineering`     | Tech leads, senior engineers         | code-reviewer, deployment-agent, test-runner    |
| `legal-compliance`| Legal counsel, compliance officer    | contract-reviewer, gdpr-export-agent            |

---

## Creating a Team

### Via API

```bash
curl -X POST http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "finance-ops",
    "description": "Finance operations team responsible for payment agents",
    "org_id": "org_01h9..."
  }'
```

**Response:**

```json
{
  "id": "team_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "name": "finance-ops",
  "description": "Finance operations team responsible for payment agents",
  "org_id": "org_01h9...",
  "created_by": "usr_01h9...",
  "member_count": 1,
  "agent_count": 0,
  "created_at": "2024-03-15T10:00:00Z"
}
```

### Via TypeScript SDK

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ token: userToken });

const team = await client.teams.create({
  name: "finance-ops",
  description: "Finance operations team responsible for payment agents",
  orgId: "org_01h9...",
});
```

### Via the Dashboard

1. Open the Storsko web app and navigate to **Teams** in the sidebar
2. Click **New Team**
3. Enter the team name and description
4. Select initial members from your organization's user list
5. Click **Create Team**

---

## Listing Teams

```bash
# List all teams in the organization
curl http://localhost:3000/api/v1/teams \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Response:**

```json
{
  "teams": [
    {
      "id": "team_01h9...",
      "name": "finance-ops",
      "description": "Finance operations team",
      "member_count": 4,
      "agent_count": 2,
      "created_at": "2024-03-01T09:00:00Z"
    },
    {
      "id": "team_02h9...",
      "name": "customer-success",
      "description": "Customer success team",
      "member_count": 6,
      "agent_count": 3,
      "created_at": "2024-03-05T11:00:00Z"
    }
  ],
  "total": 2
}
```

### Get a Specific Team

```bash
curl http://localhost:3000/api/v1/teams/team_01h9... \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Managing Team Membership

### Adding Members

```bash
curl -X POST http://localhost:3000/api/v1/teams/team_01h9.../members \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "usr_01h9...",
    "role": "member"
  }'
```

### Member Roles

| Role      | Permissions                                                           |
|-----------|-----------------------------------------------------------------------|
| `owner`   | Full team management: add/remove members, assign agents, delete team  |
| `admin`   | Add/remove members, assign agents, approve HITL requests              |
| `member`  | Approve HITL requests for team agents, view routing log               |
| `viewer`  | Read-only access to team agents and HITL queue                        |

::alert{type="default" title="Each team should have at least two `admin` or `owner` members to prevent lockout if the primary owner is unavailable."}

::

### Removing Members

```bash
curl -X DELETE \
  http://localhost:3000/api/v1/teams/team_01h9.../members/usr_01h9... \
  -H "Authorization: Bearer $USER_TOKEN"
```

When a member is removed, their pending HITL approvals are reassigned to the remaining team admins.

### Listing Team Members

```bash
curl http://localhost:3000/api/v1/teams/team_01h9.../members \
  -H "Authorization: Bearer $USER_TOKEN"
```

**Response:**

```json
{
  "members": [
    {
      "user_id": "usr_01h9...",
      "email": "alice@acmecorp.com",
      "name": "Alice Chen",
      "role": "owner",
      "joined_at": "2024-03-01T09:00:00Z"
    },
    {
      "user_id": "usr_02h9...",
      "email": "bob@acmecorp.com",
      "name": "Bob Smith",
      "role": "member",
      "joined_at": "2024-03-10T14:00:00Z"
    }
  ]
}
```

---

## Assigning Agents to Teams

Agents can belong to one team. Team membership scopes routing and HITL visibility.

### Assign an Agent to a Team

```bash
curl -X POST http://localhost:3000/api/v1/teams/team_01h9.../agents \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"agent_id": "agt_01h9..."}'
```

### Remove an Agent from a Team

```bash
curl -X DELETE \
  http://localhost:3000/api/v1/teams/team_01h9.../agents/agt_01h9... \
  -H "Authorization: Bearer $USER_TOKEN"
```

### Listing Team Agents

```bash
curl http://localhost:3000/api/v1/teams/team_01h9.../agents \
  -H "Authorization: Bearer $USER_TOKEN"
```

---

## Team-Scoped HITL

When an agent belongs to a team, HITL requests from that agent are routed to the team's member queue rather than just the agent's owner. This means:

- All `member`, `admin`, and `owner` team members can see and act on HITL requests
- The first person to approve/reject wins (no double-approval)
- If no team member acts within the timeout window, the request escalates to the team's `admin` users, then to the org admin

This ensures that team agents are never blocked by a single person's unavailability.

```typescript
// HITL request notification goes to all finance-ops team members
// when invoice-processor (a finance-ops agent) needs approval
const team = await client.teams.get("team_01h9...");
console.log(`HITL request will be visible to ${team.memberCount} team members`);
```

---

## Team-Scoped Routing

The task router uses team membership to resolve `ownership_type: "team"` routing requests. See [Task Routing](./routing) for full routing documentation.

```bash
# Route a task to the best agent in the finance-ops team
curl -X POST http://localhost:3000/api/v1/routing/resolve \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "task": {
      "capability": "data.write",
      "description": "Post invoice #INV-2024-1234 to ERP"
    },
    "ownership_type": "team",
    "team_id": "team_01h9..."
  }'
```

---

## Updating and Deleting Teams

### Update Team Details

```bash
curl -X PATCH http://localhost:3000/api/v1/teams/team_01h9... \
  -H "Authorization: Bearer $USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "finance-and-accounting",
    "description": "Finance and accounting operations"
  }'
```

### Delete a Team

```bash
curl -X DELETE http://localhost:3000/api/v1/teams/team_01h9... \
  -H "Authorization: Bearer $USER_TOKEN"
```

Deleting a team:
- Unassigns all agents from the team (agents are not deleted)
- Removes all member associations
- Cancels pending HITL requests from team agents (with notification)
- Is logged as an `admin.team_deleted` event in the audit log

::alert{type="warning" title="Team deletion cannot be undone. Make sure to reassign critical agents to another team or to org-level governance before deleting."}

::

---

## API Reference

| Method   | Endpoint                                        | Description                         |
|----------|-------------------------------------------------|-------------------------------------|
| `GET`    | `/api/v1/teams`                                 | List all teams in the org           |
| `POST`   | `/api/v1/teams`                                 | Create a new team                   |
| `GET`    | `/api/v1/teams/:id`                             | Get team details                    |
| `PATCH`  | `/api/v1/teams/:id`                             | Update team name/description        |
| `DELETE` | `/api/v1/teams/:id`                             | Delete a team                       |
| `GET`    | `/api/v1/teams/:id/members`                     | List team members                   |
| `POST`   | `/api/v1/teams/:id/members`                     | Add a member to the team            |
| `PATCH`  | `/api/v1/teams/:id/members/:user_id`            | Update member role                  |
| `DELETE` | `/api/v1/teams/:id/members/:user_id`            | Remove a member from the team       |
| `GET`    | `/api/v1/teams/:id/agents`                      | List agents assigned to the team    |
| `POST`   | `/api/v1/teams/:id/agents`                      | Assign an agent to the team         |
| `DELETE` | `/api/v1/teams/:id/agents/:agent_id`            | Remove an agent from the team       |

---

## Use Case Examples

### Financial Operations with Dual Control

```typescript
// Create finance team with two admins for dual-control on high-value approvals
const financeTeam = await client.teams.create({
  name: "finance-ops",
  orgId: orgId,
});

await client.teams.addMember(financeTeam.id, cfoUserId, { role: "owner" });
await client.teams.addMember(financeTeam.id, controllerUserId, { role: "admin" });
await client.teams.addMember(financeTeam.id, apSpecialistUserId, { role: "member" });

// Assign payment agent (requires approval from team before executing finance.transfer)
await client.teams.assignAgent(financeTeam.id, paymentAgentId);
```

### On-Call Rotation

For teams that operate 24/7, add all on-call engineers as `member` so HITL requests are visible to whoever is on duty:

```typescript
const onCallTeam = await client.teams.create({ name: "on-call-engineering" });

// Add all engineers — they can each approve/reject as needed
for (const engineerId of engineerIds) {
  await client.teams.addMember(onCallTeam.id, engineerId, { role: "member" });
}
```

---

## Related Pages

- [Task Routing](./routing) — route tasks to team agents
- [Human-in-the-Loop](../core-concepts/hitl) — team-scoped HITL approvals
- [Agents](../core-concepts/agents) — assigning agents to teams
- [Authentication](../core-concepts/authentication) — team-level JWT claims (commercial)
