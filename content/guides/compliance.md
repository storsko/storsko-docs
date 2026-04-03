---
title: "Compliance"
description: "GDPR data export and erasure, EU AI Act risk classification, and the compliance engine package."
sidebar_order: 19
---

Storsko provides built-in tooling for GDPR data rights and EU AI Act risk classification.

## GDPR

### Data export

Export all data held for a user:

```http
GET /api/v1/audit/:user_id/export
Authorization: Bearer <root-api-key>
```

Returns a JSON bundle of audit log entries, agent assignments, and HITL decisions associated with the user.

### Data erasure

Delete all personal data for a user (right to erasure):

```http
DELETE /api/v1/users/:id/data
Authorization: Bearer <root-api-key>
```

Storsko pseudonymises audit log entries (replacing `user_id` with a tombstone marker) rather than hard-deleting them, to preserve the hash-chain integrity of the audit log.

## EU AI Act — risk classification

Every agent has a `risk_level` field aligned with the EU AI Act categories:

| Level | Description |
|-------|-------------|
| `minimal` | No meaningful risk — informational or productivity tooling |
| `limited` | Some transparency obligations apply |
| `high` | Regulated domains: hiring, credit, law enforcement, biometrics |
| `unacceptable` | Prohibited use cases |

### Setting risk level

```http
PATCH /api/v1/agents/:id/risk-level
Authorization: Bearer <root-api-key>
Content-Type: application/json

{ "risk_level": "high" }
```

`high`-risk agents automatically have all HITL requests escalated to org admin regardless of individual capability settings.

## Compliance engine package

The `compliance-engine` package (`packages/compliance-engine`) exposes:

- `classifyRiskLevel(agent)` — returns the appropriate EU AI Act tier.
- `buildGdprExport(userId, db)` — assembles the full data export bundle.
- `validateErasure(userId, db)` — checks whether erasure can proceed safely.
