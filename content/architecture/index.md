---
title: "Architecture Overview"
description: "How Storsko is structured — the governance chokepoint, data flows, package composition, database schema, and security model."
sidebar_order: 11
icon: "lucide:layers"
---

Storsko is designed around a single core principle: **every agent action flows through a governance chokepoint**. This document explains how the system is structured, how data flows through it, and how the packages compose into a coherent whole.

---

## High-Level Architecture

```
 ┌──────────────────────────────────────────────────────────────────────────┐
 │                         Your Application / Agent Runtime                 │
 │             (NemoClaw, OpenClaw, LangChain, CrewAI, custom)              │
 └────────────────────────────────┬─────────────────────────────────────────┘
                                  │
                    @storsko/execution-adapter
                    (governance chokepoint)
                                  │
              ┌───────────────────▼───────────────────┐
              │           @storsko/api-server           │
              │    Fastify REST API  ·  port 3000        │
              │                                         │
              │  /api/v1/agents    /api/v1/capabilities │
              │  /api/v1/hitl      /api/v1/audit        │
              │  /api/v1/teams     /api/v1/routing      │
              │  /api/v1/llm       /api/v1/notifications│
              └───┬──────────────┬────────────────┬────┘
                  │              │                │
       ┌──────────▼──┐  ┌────────▼──────┐  ┌─────▼──────────┐
       │ @storsko/   │  │  @storsko/    │  │  @storsko/     │
       │ agent-hub   │  │  capability-  │  │  llm-gateway   │
       │             │  │  registry     │  │                │
       │ Agent reg.  │  │  Cap. defs    │  │ OpenAI/Anthropic│
       │ Risk levels │  │  Grant/revoke │  │ PII detection  │
       └──────────┬──┘  └────────┬──────┘  └─────┬──────────┘
                  │              │                │
              ┌───▼──────────────▼────────────────▼───┐
              │                                         │
              │              PostgreSQL 15              │
              │                                         │
              │  agents         capabilities            │
              │  hitl_requests  audit_log               │
              │  teams          team_members            │
              │  routing_log    notifications_config    │
              └─────────────────────────────────────────┘
```

The web dashboard (`apps/web`, Next.js 15) and the TypeScript SDK (`@storsko/sdk`) both consume the same REST API. There is no separate internal API — the public REST API is the only interface.

---

## The Governance Chokepoint

The `@storsko/execution-adapter` is the most important architectural concept in Storsko. It is the single point through which all agent actions must pass.

When an agent wants to take an action (write a file, mutate a database, call an API, send an email), it does not call the underlying system directly. Instead it calls `adapter.execute()`. The adapter then:

1. **Authenticates** the agent using its API key
2. **Checks capability** — does this agent have the requested capability?
3. **Evaluates HITL policy** — does this capability require human approval for this agent's risk level?
4. **Blocks or proceeds** — if HITL is required, creates a pending request and optionally waits for a decision; if not, signals approval to the caller
5. **Records the outcome** — writes a `hitl.created`, `hitl.approved`, `hitl.rejected`, or `execution.completed` event to the audit log

If the capability is not granted, the adapter throws `CAPABILITY_NOT_GRANTED` immediately and writes a `capability.denied` audit event. The agent never reaches the underlying system.

This pattern means:

- Governance is enforced by the infrastructure, not by individual agent developers
- Adding a new capability check does not require changing any agent code
- The audit log is complete by construction — there is no way for an agent to act without creating a record

---

## Data Flow

### Happy Path: Capability with `hitlMode: never`

```
Agent code
  │
  └─► execution-adapter.execute({ capability: "file:read", ... })
            │
            ├─► POST /api/v1/execution/check
            │       │
            │       ├─► capability-registry: agent has "file:read"? → yes
            │       ├─► HITL policy: hitlMode = "never" → skip
            │       └─► audit: write "execution.approved" event
            │
            └─► return { status: "approved", executionId: "exec_..." }

Agent code continues with the action.
```

### HITL Path: Capability with `hitlMode: always`

```
Agent code
  │
  └─► execution-adapter.execute({ capability: "db:mutate", waitForApproval: true })
            │
            ├─► POST /api/v1/hitl (create pending request)
            │       └─► audit: write "hitl.created" event
            │
            ├─► [polling] GET /api/v1/hitl/:id
            │       │
            │       │   (Reviewer sees request in web dashboard or API)
            │       │   (Reviewer calls POST /api/v1/hitl/:id/approve)
            │       │       └─► audit: write "hitl.approved" event
            │       │
            │       └─► status changes to "approved"
            │
            └─► return { status: "approved", executionId: "exec_..." }

Agent code continues with the action.
```

### Denied Path: Capability Not Granted

```
Agent code
  │
  └─► execution-adapter.execute({ capability: "email:send", ... })
            │
            ├─► POST /api/v1/execution/check
            │       │
            │       ├─► capability-registry: agent has "email:send"? → no
            │       └─► audit: write "capability.denied" event
            │
            └─► throw CapabilityError("CAPABILITY_NOT_GRANTED")

Agent code receives error. Action is never attempted.
```

---

## Package Composition

The Storsko monorepo is organised as a Turborepo workspace. Here is how the packages relate to each other:

```
apps/
  web/              # Next.js 15 dashboard (depends on @storsko/sdk)
  docs/             # Docusaurus documentation

packages/
  api-server/       # Fastify REST API (depends on all other packages)
  sdk/              # TypeScript client (depends on nothing internal)
  auth/             # Key generation, JWT (depended on by api-server)
  capability-registry/  # Cap definitions (depended on by api-server, execution-adapter)
  execution-adapter/    # Governance chokepoint (depends on sdk)
  agent-hub/            # Agent registration (depended on by api-server)
  llm-gateway/          # LLM proxy + PII (depended on by api-server)
```

The dependency graph is acyclic. The `api-server` is the only package that depends on all others. The `sdk` depends on nothing internal, making it safe to publish independently.

---

## Database Schema Overview

Storsko uses Drizzle ORM with PostgreSQL. The schema is defined in `packages/api-server/src/db/schema.ts`.

### `agents`

Stores registered agents.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `name` | `text` | Human-readable name |
| `description` | `text` | Optional description |
| `status` | `text` | `active`, `inactive` |
| `risk_level` | `text` | `minimal`, `limited`, `high`, `unacceptable` |
| `owner_id` | `text` | User or team ID |
| `org_id` | `text` | Organisation (commercial multi-tenancy) |
| `created_at` | `timestamp` | |
| `updated_at` | `timestamp` | |

### `capabilities`

Tracks capability grants per agent.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `agent_id` | `text` | FK → `agents.id` |
| `capability` | `text` | Capability identifier (e.g. `db:mutate`) |
| `hitl_mode` | `text` | `never`, `always`, `on_risk` |
| `granted_by` | `text` | Actor who granted |
| `granted_at` | `timestamp` | |
| `revoked_at` | `timestamp` | Null if still active |

### `hitl_requests`

Stores human-in-the-loop review requests.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `agent_id` | `text` | FK → `agents.id` |
| `capability` | `text` | Capability being requested |
| `action` | `text` | Action name |
| `payload` | `jsonb` | The full action payload |
| `status` | `text` | `pending`, `approved`, `rejected`, `escalated`, `timeout` |
| `reviewer_id` | `text` | Who reviewed it (null if pending) |
| `reviewed_at` | `timestamp` | Null if pending |
| `comment` | `text` | Reviewer comment or rejection reason |
| `escalated_to` | `text` | Escalation target (email/user ID) |
| `created_at` | `timestamp` | |
| `expires_at` | `timestamp` | Auto-timeout time |

### `audit_log`

Append-only event log. Rows are never updated or deleted (except via GDPR erasure, which replaces PII with `[REDACTED]`).

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `event` | `text` | Event type (e.g. `agent.registered`, `hitl.approved`) |
| `agent_id` | `text` | Associated agent (nullable) |
| `actor_id` | `text` | Who triggered the event |
| `metadata` | `jsonb` | Event-specific data |
| `ip_address` | `text` | Request IP (nullable) |
| `timestamp` | `timestamp` | Event time, server-side |

### `teams`

Organisational teams (commercial Teams+ tier).

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `name` | `text` | Team name |
| `description` | `text` | Optional |
| `org_id` | `text` | Organisation |
| `created_at` | `timestamp` | |

### `team_members`

Many-to-many relationship between users and teams.

| Column | Type | Notes |
|---|---|---|
| `team_id` | `text` | FK → `teams.id` |
| `user_id` | `text` | User ID |
| `role` | `text` | `owner`, `member` |
| `added_at` | `timestamp` | |

### `routing_log`

Records task routing decisions.

| Column | Type | Notes |
|---|---|---|
| `id` | `text` | ULID, primary key |
| `task` | `text` | Task description |
| `ownership_type` | `text` | How ownership was resolved |
| `resolved_agent_id` | `text` | Agent assigned |
| `resolved_team_id` | `text` | Team assigned (if applicable) |
| `delegated` | `boolean` | Whether the task was delegated |
| `metadata` | `jsonb` | Additional routing context |
| `created_at` | `timestamp` | |

---

## OSS vs Commercial Architecture Differences

The OSS core and commercial platform share the same API server, database schema, and package structure. The commercial platform adds:

| Layer | OSS | Commercial |
|---|---|---|
| Authentication | API key only | API key + Keycloak JWT (OIDC/SAML/LDAP) |
| Multi-tenancy | Single tenant | Org-scoped data isolation via `org_id` |
| Teams | Not included | Teams, membership, delegation |
| Routing | Not included | Task routing engine + routing log |
| Notifications | Not included | Slack, MS Teams webhooks |
| Billing | Not applicable | Stripe subscription enforcement |
| Hosting | Self-hosted only | Managed or self-hosted |

The commercial additions are implemented as conditional middleware and feature flags, not separate codebases. When running the OSS core, multi-tenancy middleware is a no-op, teams endpoints return 404, and routing endpoints are disabled.

---

## Security Model

### API Key Authentication

All REST API requests must include an `x-api-key` header. Keys are HMAC-signed with `ROOT_API_KEY_SECRET`. The root key has full access. Per-agent keys (scoped to a single agent) can be issued for agent-to-governance communication.

### JWT Authentication

The web dashboard uses short-lived JWTs for session authentication. JWTs are issued by the API server after successful API key or Keycloak authentication.

### Principle of Least Privilege

Agents should be granted only the capabilities they need. The `CAPABILITY_NOT_GRANTED` denial is audited, making it easy to identify agents attempting to exceed their permissions.

### Audit Log Integrity

The audit log is append-only at the application layer. No REST endpoint allows updating or deleting audit entries. GDPR erasure replaces PII content with `[REDACTED]` but preserves the event record structure.

For maximum integrity in regulated environments, configure your PostgreSQL role to revoke `DELETE` and `UPDATE` privileges on the `audit_log` table:

```sql
-- Run as database superuser
REVOKE UPDATE, DELETE ON audit_log FROM storsko;
```

---

## Next Steps

- [Package Reference](./packages.md) — detailed documentation for each package
- [REST API Reference](../api-reference/) — full endpoint reference
- [Docker Deployment](../deployment/) — containerised deployment
