---
title: "Authentication & Authorization"
description: "Root API keys, agent JWTs, Keycloak SSO, and the two-layer authentication model in Storsko."
sidebar_order: 5
icon: "lucide:shield"
---

Storsko uses a two-layer authentication model. The **root API key** authenticates operators and administrators who manage the Storsko instance. **Agent JWTs** authenticate individual agents at runtime. In the commercial platform, Keycloak SSO adds a third layer for human users accessing the dashboard and APIs.

---

## OSS Authentication

### Root API Key

When you start Storsko for the first time via `make setup`, a root API key is generated automatically and printed to stdout. This key is the master credential for your OSS deployment.

**Key format:**

```
storsko_root_{64 hex characters}
```

**Example:**

```
storsko_root_a3f8c2d1e4b07659f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4
```

The 64-character hex suffix is generated from a cryptographically secure random source. The key is stored in PostgreSQL as a **SHA-256 hash** — the plaintext is never persisted. This means if you lose the key, you must rotate it via the CLI.

::alert{type="warning" title="The root API key is displayed **only once** at setup time. Store it in a secrets manager (HashiCorp Vault, AWS Secrets Manager, 1Password) immediately. There is no "show me the key again" command."}

::

**How the key is stored:**

```sql
-- Internal representation (simplified)
CREATE TABLE api_keys (
  id          UUID PRIMARY KEY,
  key_hash    TEXT NOT NULL,   -- SHA-256 of plaintext key
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used   TIMESTAMPTZ
);
```

Storsko hashes the incoming key on every request and compares it to the stored hash — the plaintext never touches the database.

### Generating / Rotating the Root API Key

```bash
# Initial setup — generates and prints root key
make setup

# Rotate the root key (invalidates the old one immediately)
make rotate-key
```

The rotate command atomically replaces the stored hash. Any service using the old key will receive `401 Unauthorized` immediately after rotation.

### Using the Root API Key

Pass the key in the `Authorization` header as a Bearer token:

```bash
curl -H "Authorization: Bearer storsko_root_a3f8c2d..." \
  http://localhost:3000/api/v1/agents
```

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({
  baseUrl: "http://localhost:3000",
  apiKey: process.env.STORSKO_ROOT_KEY,
});

const agents = await client.agents.list();
```

---

## Agent JWTs

Agents do not use the root API key. Instead, each agent receives a short-lived **JWT** signed with HS256 when it registers or authenticates. This scopes the agent to its own capabilities and prevents agents from performing administrative operations.

### JWT Generation

When an agent registers via `POST /api/v1/agents`, the API server issues a JWT:

```typescript
// packages/auth — manual HS256 signing
const payload = {
  sub: agent.id,
  agent_id: agent.id,
  org_id: agent.owner_org_id,
  capabilities: agent.capabilities, // array of granted capability strings
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour TTL
};

const token = signJwt(payload, process.env.JWT_SECRET, { algorithm: "HS256" });
```

### JWT Payload Structure

| Field          | Type       | Description                                          |
|----------------|------------|------------------------------------------------------|
| `sub`          | `string`   | Agent UUID (same as `agent_id`)                      |
| `agent_id`     | `string`   | Agent UUID                                           |
| `org_id`       | `string`   | Owning organization UUID                             |
| `capabilities` | `string[]` | Array of capability strings granted to this agent    |
| `iat`          | `number`   | Issued-at timestamp (Unix seconds)                   |
| `exp`          | `number`   | Expiry timestamp (Unix seconds)                      |

**Example decoded payload:**

```json
{
  "sub": "agt_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "agent_id": "agt_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "org_id": "org_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "capabilities": [
    "web.search",
    "file.read",
    "email.send"
  ],
  "iat": 1711800000,
  "exp": 1711803600
}
```

### Using the Agent JWT

```bash
# Agents authenticate with Bearer token just like the root key
curl -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  http://localhost:3000/api/v1/executions
```

```typescript
import { StorskoClient } from "@storsko/sdk";

// Agents receive their token after registration
const agentClient = new StorskoClient({
  baseUrl: "http://localhost:3000",
  token: agentJwt,
});

await agentClient.executions.run({
  capability: "web.search",
  input: { query: "latest AI safety research" },
});
```

### Token Refresh

Agent JWTs expire after 1 hour by default. Agents should refresh their token before expiry:

```typescript
// Refresh before expiry
const { token } = await client.auth.refreshAgentToken(agentId);
```

The refresh endpoint validates that the agent is still active and its capabilities haven't changed. If the agent has been deactivated, the refresh fails with `403 Forbidden`.

---

## Commercial Authentication (Keycloak SSO)

The commercial Storsko platform replaces the simple root-key model with Keycloak for human user authentication. Agent JWTs continue to work as described above.

### Keycloak Integration

Storsko's commercial platform ships a pre-configured Keycloak realm (`storsko`) that handles:

- Username/password authentication
- OAuth 2.0 / OIDC flows
- Social login (Google, GitHub — see `storsko/social-login.md`)
- Multi-factor authentication
- Session management

```
User → Keycloak (/auth/realms/storsko) → JWT → Storsko API
```

### Commercial JWT Claims

The commercial JWT extends the OIDC standard claims with Storsko-specific fields:

| Claim              | Type      | Description                                              |
|--------------------|-----------|----------------------------------------------------------|
| `sub`              | `string`  | Keycloak user UUID                                       |
| `user_id`          | `string`  | Storsko internal user UUID                               |
| `email`            | `string`  | User email address                                       |
| `tenant_id`        | `string`  | Organization / tenant UUID                               |
| `tier`             | `string`  | Subscription tier: `personal`, `teams`, `enterprise`     |
| `role`             | `string`  | User role: `owner`, `admin`, `member`, `viewer`          |
| `has_subscription` | `boolean` | Whether the tenant has an active Stripe subscription     |
| `managed`          | `boolean` | Whether this is a Storsko-managed cloud deployment       |
| `iat`              | `number`  | Issued-at                                                |
| `exp`              | `number`  | Expiry                                                   |

**Example decoded commercial JWT:**

```json
{
  "sub": "keycloak-uuid-here",
  "user_id": "usr_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "email": "alice@acmecorp.com",
  "tenant_id": "ten_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "tier": "enterprise",
  "role": "admin",
  "has_subscription": true,
  "managed": false,
  "iat": 1711800000,
  "exp": 1711803600
}
```

### Subscription Tiers

| Tier         | Description                                               |
|--------------|-----------------------------------------------------------|
| `personal`   | Single-user, OSS-equivalent feature set                   |
| `teams`      | Multi-user, team management, shared capability grants     |
| `enterprise` | Full feature set: multi-tenancy, SSO, SLA, audit export   |

### OIDC Login Flow

```
1. User visits Storsko dashboard
2. Redirected to Keycloak: GET /auth/realms/storsko/protocol/openid-connect/auth
3. User authenticates with Keycloak
4. Keycloak redirects back with authorization code
5. API server exchanges code for tokens: POST /auth/realms/storsko/protocol/openid-connect/token
6. Access token stored in session; refresh token used for silent renewal
```

```bash
# Example: exchange authorization code for tokens
curl -X POST \
  https://auth.storsko.io/auth/realms/storsko/protocol/openid-connect/token \
  -d "grant_type=authorization_code" \
  -d "client_id=storsko-dashboard" \
  -d "code=<authorization_code>" \
  -d "redirect_uri=https://app.storsko.io/callback"
```

---

## Authorization Middleware

The `packages/api-server` applies authorization at two levels: route-level guards and capability-level checks in the execution adapter.

### Route Guards

Every Fastify route is protected by one of three guard types:

```typescript
// Require valid root API key
fastify.get("/agents", { preHandler: [requireRootKey] }, handler);

// Require valid agent JWT
fastify.post("/executions", { preHandler: [requireAgentJwt] }, handler);

// Require Keycloak JWT (commercial only) with minimum role
fastify.delete("/users/:id/data", {
  preHandler: [requireKeycloakJwt, requireRole("admin")],
}, handler);
```

### Capability-Level Authorization

When an agent attempts to execute a capability, the **execution adapter** (`packages/execution-adapter`) validates the capability against the agent's JWT claims before any execution takes place:

```
POST /api/v1/executions
  → validate agent JWT
  → extract capabilities[] from JWT
  → check requested capability is in capabilities[]
  → check capability grant is still active in DB (not revoked)
  → proceed to HITL evaluation
  → execute (or block)
  → write audit log entry
```

If the capability is not in the JWT, the request is rejected immediately with `403 Forbidden` — no HITL, no audit entry for the attempt (though failed auth attempts are logged separately).

---

## Code Examples

### TypeScript SDK — Root Key Authentication

```typescript
import { StorskoClient } from "@storsko/sdk";

const storsko = new StorskoClient({
  baseUrl: process.env.STORSKO_BASE_URL ?? "http://localhost:3000",
  apiKey: process.env.STORSKO_ROOT_KEY,
});

// List all agents
const { agents } = await storsko.agents.list();
console.log(`Found ${agents.length} agents`);
```

### TypeScript SDK — Agent Authentication

```typescript
import { StorskoClient } from "@storsko/sdk";

// After agent registration, use the issued JWT
const agentClient = new StorskoClient({
  baseUrl: process.env.STORSKO_BASE_URL ?? "http://localhost:3000",
  token: process.env.AGENT_JWT,
});

// Execute a capability as this agent
const result = await agentClient.executions.run({
  capability: "web.search",
  input: { query: "storsko documentation" },
});
```

### curl — Verify Authentication

```bash
# Test root key
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  http://localhost:3000/api/v1/agents
# Expected: 200

# Test with no credentials
curl -s -o /dev/null -w "%{http_code}" \
  http://localhost:3000/api/v1/agents
# Expected: 401
```

---

## Security Best Practices

### Key Rotation

Rotate the root API key regularly, especially after team member changes:

```bash
make rotate-key
```

::alert{type="default" title="Automate key rotation in your CI/CD pipeline. Store keys in your secrets manager and update them on a quarterly schedule or after any security incident."}

::

### Minimal Scope

Grant agents only the capabilities they need. An agent that only needs to search the web should not have `finance.transfer` in its JWT:

```typescript
// Bad: over-privileged agent
await storsko.agents.create({
  name: "search-agent",
  capabilities: ["web.search", "finance.transfer", "code.execute"], // too broad
});

// Good: minimal capabilities
await storsko.agents.create({
  name: "search-agent",
  capabilities: ["web.search"], // only what is needed
});
```

### JWT Expiry

Keep agent JWT TTLs short. The default is 1 hour. For highly sensitive agents, reduce this to 15 minutes and implement automatic refresh logic.

### Environment Variables

Never hardcode credentials. Use environment variables and a secrets manager:

```bash
# .env (never commit to git)
STORSKO_ROOT_KEY=storsko_root_a3f8c2d...
JWT_SECRET=a-long-random-secret-string
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

::alert{type="danger" title="Never commit `.env` files or API keys to version control. Add `.env` to your `.gitignore`. Scan your git history for accidental credential commits using tools like `git-secrets` or `trufflehog`."}

::

### Network Security

In production, place Storsko behind a reverse proxy (nginx, Caddy, AWS ALB) and:

- Enable TLS/HTTPS — never send API keys over plain HTTP
- Restrict the API port to your internal network or VPN
- Use IP allowlisting for root API key endpoints if possible

---

## Related Pages

- [Capabilities](./capabilities) — what agents are authorized to do
- [Agents](./agents) — agent registration and lifecycle
- [Audit Log](./audit-log) — tracking all authenticated actions
- [Compliance](../guides/compliance) — GDPR and EU AI Act requirements
