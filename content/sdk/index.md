---
title: "SDK Overview"
description: "The official TypeScript client for Storsko Core — installation, initialization, and API methods."
sidebar_order: 16
icon: "lucide:package"
---

The official TypeScript client for Storsko Core. Provides typed API methods, shared constants, and all type definitions used across the platform.

## Installation

```bash
npm install @storsko/sdk
# or
pnpm add @storsko/sdk
```

## Initialisation

```typescript
import { StorskоClient } from '@storsko/sdk';

const client = new StorskoClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'storsko_root_<64-hex-chars>',
});
```

## Agents

```typescript
// List agents
const agents = await client.agents.list();

// Register an agent
const agent = await client.agents.create({
  name: 'Research Bot',
  description: 'Handles web research tasks',
});

// Get a single agent
const agent = await client.agents.get('agent_id');
```

## Capabilities

```typescript
// List capability definitions
const caps = await client.capabilities.list();

// Grant a capability
await client.capabilities.grant({
  agent_id: 'agent_id',
  capability: 'web.search',
  hitl_mode: 'auto',
});
```

## HITL

```typescript
// List pending requests
const pending = await client.hitl.list({ status: 'pending' });

// Approve
await client.hitl.approve('hitl_request_id', { comment: 'Looks good' });

// Reject
await client.hitl.reject('hitl_request_id', { reason: 'Out of scope' });
```

## Teams

```typescript
// Create a team
const team = await client.teams.create({ name: 'ML Ops' });

// Add a member
await client.teams.addMember(team.id, { user_id: 'user_id' });
```

## Types

All types are exported from `@storsko/sdk/types`:

```typescript
import type {
  Agent,
  CapabilityGrant,
  HitlRequest,
  AuditEntry,
  Team,
} from '@storsko/sdk/types';
```

## Constants

```typescript
import { HARDCODED_CAPABILITIES, HITL_MODES } from '@storsko/sdk/constants';
```

`HARDCODED_CAPABILITIES` lists capabilities (e.g. `phone.call`, `finance.transfer`) that always escalate to org admin and cannot be set to `auto` mode.
