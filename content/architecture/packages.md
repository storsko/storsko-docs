---
title: "Package Reference"
description: "Detailed documentation for each Storsko Core package — SDK, auth, capability-registry, execution-adapter, agent-hub, llm-gateway, api-server."
sidebar_order: 12
---

Storsko Core is a pnpm monorepo. All packages live under `packages/` and the web app under `apps/web/`.

## @storsko/sdk

**Path:** `packages/sdk`
**Purpose:** TypeScript client, shared types, and API constants. The only package that `apps/web` imports.

### Key exports

```typescript
// Client
export class StorSkoClient { ... }

// Types
export type Agent = { id: string; name: string; description?: string; capabilities: string[]; riskLevel: RiskLevel; nodeLastSeen?: string; ... }
export type CapabilityGrant = { agentId: string; capability: string; hitlMode: HitlMode }
export type HitlRequest = { id: string; agentId: string; capability: string; status: HitlStatus; createdAt: string; ... }
export type AuditEntry = { id: string; agentId: string; capability: string; outcome: string; hash: string; prevHash?: string; ... }
export type Team = { id: string; name: string; description?: string; memberCount: number }

// Enums
export type HitlMode = 'auto' | 'propose' | 'notify' | 'escalate' | 'block'
export type HitlStatus = 'pending' | 'approved' | 'rejected' | 'timed_out' | 'escalated'
export type RiskLevel = 'minimal' | 'limited' | 'high' | 'unacceptable'

// Constants
export const CAPABILITIES: string[]  // full list of built-in capability names
export const API_VERSION = 'v1'
```

### Installation

```bash
pnpm add @storsko/sdk
```

### Usage

```typescript
import { StorSkoClient } from '@storsko/sdk';

const client = new StorSkoClient({
  baseUrl: process.env.STORSKO_API_URL,
  apiKey: process.env.STORSKO_API_KEY,
});
```

---

## @storsko/auth

**Path:** `packages/auth`
**Purpose:** Key generation and JWT handling. No external auth library — pure Node.js crypto.

### Key exports

```typescript
// Root API key
export function generateRootKey(): string
// Returns: "storsko_root_" + 64 hex chars (SHA256 of random bytes)

export function hashRootKey(rawKey: string): string
// Returns: SHA256 hex of the key (stored in DB, never the raw key)

export function verifyRootKey(rawKey: string, storedHash: string): boolean

// Agent JWT (HS256, manual implementation)
export function signAgentJwt(payload: AgentJwtPayload, secret: string, expiresIn?: string): string
export function verifyAgentJwt(token: string, secret: string): AgentJwtPayload

export type AgentJwtPayload = {
  sub: string        // agent_id
  agent_id: string
  tenant_id?: string
  capabilities: string[]
  iat: number
  exp: number
}

// Commercial: Keycloak JWT verification
export function verifyKeycloakJwt(token: string, jwksUri: string): Promise<KeycloakClaims>
export type KeycloakClaims = {
  sub: string
  email: string
  preferred_username: string
  realm_access?: { roles: string[] }
}
```

### Security notes

- Root keys are hashed with SHA256 before storage. The raw key is shown once at setup time and never stored.
- Agent JWTs use HS256 with the `JWT_SECRET` env var. The secret must be at least 32 characters.
- In commercial mode, the same `JWT_SECRET` is shared between `platform-api` and `storsko-landing` for the `/api/account/status` endpoint that decodes claims locally.

---

## @storsko/capability-registry

**Path:** `packages/capability-registry`
**Purpose:** Canonical list of capabilities, grant storage, and validation logic.

### Key exports

```typescript
// Built-in capabilities catalogue
export const BUILT_IN_CAPABILITIES: CapabilityDefinition[]

export type CapabilityDefinition = {
  name: string           // e.g. "file.write"
  category: string       // e.g. "file"
  description: string
  defaultHitlMode: HitlMode
  hardcoded: boolean     // true = always escalate, cannot override
  riskScore: number      // 0–100
}

// Hardcoded high-risk capabilities (always escalate)
export const HARDCODED_CAPABILITIES: string[]
// ["phone.call", "finance.transfer", "finance.payment", "system.shutdown", "data.delete"]

// Grant management
export async function grantCapability(db: Db, agentId: string, capability: string, hitlMode: HitlMode): Promise<void>
export async function revokeCapability(db: Db, agentId: string, capability: string): Promise<void>
export async function getGrant(db: Db, agentId: string, capability: string): Promise<CapabilityGrant | null>
export async function listGrants(db: Db, agentId: string): Promise<CapabilityGrant[]>

// Validation
export function validateCapabilityName(name: string): boolean
export function isHardcoded(capability: string): boolean
```

---

## @storsko/execution-adapter

**Path:** `packages/execution-adapter`
**Purpose:** The governance chokepoint. Every capability execution passes through here.

### Key exports

```typescript
export async function executeCapability(
  db: Db,
  opts: ExecutionOptions
): Promise<ExecutionResult>

export type ExecutionOptions = {
  agentId: string
  capability: string
  payload: unknown
  requestedBy?: string  // user_id for audit
  skipHitl?: boolean    // only for internal system calls
}

export type ExecutionResult =
  | { status: 'executed'; auditId: string }
  | { status: 'pending_hitl'; hitlRequestId: string }
  | { status: 'blocked'; reason: string }

// Runtime selector (OSS default: NemoClaw, fallback: OpenClaw)
export function selectRuntime(capability: string): Runtime
// Controlled by RUNTIME_FALLBACK=openclaw env var
```

### Execution flow (code-level)

```typescript
async function executeCapability(db, { agentId, capability, payload }) {
  // 1. Check grant
  const grant = await getGrant(db, agentId, capability);
  if (!grant) throw new CapabilityNotGrantedError();

  // 2. Determine effective HITL mode
  const mode = isHardcoded(capability) ? 'escalate' : grant.hitlMode;

  // 3. HITL gate
  if (mode === 'block') {
    return { status: 'blocked', reason: 'capability blocked by policy' };
  }
  if (mode === 'propose' || mode === 'escalate') {
    const req = await createHitlRequest(db, { agentId, capability, payload, mode });
    return { status: 'pending_hitl', hitlRequestId: req.id };
  }

  // 4. Execute (mode: auto or notify)
  const runtime = selectRuntime(capability);
  const result = await runtime.execute(capability, payload);

  // 5. Audit
  const prev = await getLastAuditEntry(db, agentId);
  await appendAuditEntry(db, {
    agentId, capability, payload, outcome: 'executed',
    prevHash: prev?.hash,
    hash: sha256(serialize({ agentId, capability, payload, prevHash: prev?.hash }))
  });

  if (mode === 'notify') await sendNotification({ agentId, capability, result });

  return { status: 'executed', auditId: entry.id };
}
```

---

## @storsko/agent-hub

**Path:** `packages/agent-hub`
**Purpose:** External agent registration and the Storsko Node protocol.

### Key exports

```typescript
// Agent CRUD
export async function registerAgent(db: Db, data: AgentRegistration): Promise<Agent>
export async function getAgent(db: Db, id: string): Promise<Agent | null>
export async function listAgents(db: Db, tenantId?: string): Promise<Agent[]>
export async function deactivateAgent(db: Db, id: string): Promise<void>
export async function transferAgent(db: Db, id: string, toOrgId: string): Promise<void>

// Node protocol
export async function issueSetupToken(db: Db, agentId: string): Promise<string>
export async function activateNode(db: Db, token: string, nodeId: string): Promise<Agent>
export async function heartbeat(db: Db, agentId: string): Promise<void>
// Updates agents.node_last_seen = now()
```

### Storsko Node protocol

The Node protocol is used by `storsko/node` containers (Dockerfile-based agents). The flow is:

```
1. Admin calls: POST /api/v1/agents/:id/setup-token
   → Returns one-time setup token

2. Node container runs install script:
   curl -sSL https://storsko.com/install | sh -s -- --token <token>

3. Node calls: POST /api/v1/node/activate
   { token, nodeId: "<machine-id>" }
   → Token verified + marked used
   → Returns agent JWT

4. Node uses JWT for all subsequent calls
5. Node sends heartbeat: POST /api/v1/node/heartbeat
   → Updates node_last_seen (used by router for freshness)
```

---

## @storsko/llm-gateway

**Path:** `packages/llm-gateway`
**Purpose:** Unified routing to OpenAI and Anthropic with PII scanning.

### Key exports

```typescript
export async function chat(request: ChatRequest): Promise<ChatResponse>

export type ChatRequest = {
  model: string        // e.g. "gpt-4o", "claude-3-5-sonnet-20241022"
  messages: Message[]
  agentId?: string     // if set, appended to audit log
  scanPii?: boolean    // default: true
}

export type ChatResponse = {
  content: string
  model: string
  usage: { promptTokens: number; completionTokens: number }
  piiDetected: boolean
  piiRedacted: boolean
}

// PII scanner
export function scanPii(text: string): PiiScanResult
export type PiiScanResult = {
  detected: boolean
  entities: Array<{ type: string; value: string; redacted: string }>
  redactedText: string
}

// Router
export function routeModel(model: string): 'openai' | 'anthropic'
```

### Supported models

| Provider | Models |
|---|---|
| OpenAI | `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, `gpt-3.5-turbo` |
| Anthropic | `claude-opus-4-6`, `claude-sonnet-4-6`, `claude-haiku-4-5-20251001`, `claude-3-5-sonnet-20241022` |

---

## @storsko/api-server

**Path:** `packages/api-server`
**Purpose:** Fastify REST API. Composes all other packages into HTTP endpoints.

### Route structure

```
/api/v1/
  agents/           → agent-hub
  capabilities/     → capability-registry
  execute/          → execution-adapter
  hitl/             → hitl queue (DB)
  audit/            → audit log (DB)
  teams/            → teams (DB)
  routing/          → task router
  llm/              → llm-gateway
  notifications/    → notification config
  users/            → user management (GDPR)

/internal/v1/       → platform-api only (Keycloak, billing)
  auth/
  tenants/
```

### Middleware stack

```
Request
  → cors
  → helmet
  → rate-limiter
  → auth (verify root key OR agent JWT)
  → route handler
  → error handler
Response
```

---

## apps/web

**Path:** `apps/web`
**Purpose:** Next.js 15 OSS dashboard.

### Pages

| Route | Description |
|---|---|
| `/` | Dashboard overview |
| `/agents` | Agent list |
| `/agents/[id]` | Agent detail + capabilities |
| `/hitl` | Pending HITL requests |
| `/audit` | Audit log viewer |
| `/teams` | Team management |
| `/routing` | Routing log |
| `/settings/notifications` | Notification config |
| `/programme` | Employee Agent Programme (Teams+) |

The web app imports only `@storsko/sdk`. It never imports server-side packages directly.
