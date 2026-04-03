---
title: "Audit Log"
description: "Append-only, SHA-256 hash-chained audit log for tamper-proof traceability, GDPR export, and compliance."
sidebar_order: 8
---

The Storsko audit log is an append-only, tamper-evident record of every significant event in the system. Every capability execution, HITL decision, agent registration, authentication event, and administrative action is written to the audit log. Entries cannot be modified or deleted (subject to GDPR erasure, described below).

The audit log is central to Storsko's compliance story: it satisfies the EU AI Act's traceability requirements, supports GDPR data access requests, and provides the evidence trail required for SOC2 audits.

---

## Design: SHA-256 Hash Chain

The audit log uses a **hash chain** to ensure tamper-evidence. Each log entry contains the SHA-256 hash of the previous entry. This means:

- If any historical entry is modified, all subsequent entries have incorrect `prev_hash` values
- Any external verifier can detect tampering by re-computing the chain
- Entries cannot be silently deleted without breaking the chain

```
Entry N-1 ──hash──→ prev_hash in Entry N ──hash──→ prev_hash in Entry N+1
```

```typescript
// packages/api-server — audit log write (simplified)
async function writeAuditEntry(event: AuditEvent): Promise<AuditEntry> {
  const lastEntry = await db.query.auditLog
    .findFirst({ orderBy: desc(auditLog.createdAt) });

  const prevHash = lastEntry?.hash ?? "genesis";

  const entryData = {
    ...event,
    prev_hash: prevHash,
    created_at: new Date().toISOString(),
  };

  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(entryData))
    .digest("hex");

  return await db.insert(auditLog).values({ ...entryData, hash }).returning();
}
```

### Verifying Chain Integrity

```bash
# Verify the audit chain has not been tampered with
curl http://localhost:3000/api/v1/audit/verify \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

**Response:**

```json
{
  "chain_valid": true,
  "entries_checked": 4821,
  "first_entry_id": "aud_genesis_...",
  "last_entry_id": "aud_01h9...",
  "verified_at": "2024-03-15T12:00:00Z"
}
```

::alert{type="info" title="Chain verification is a read-heavy operation. For large deployments, run it asynchronously on a schedule rather than on every request. The verification endpoint is rate-limited to 1 request per minute per API key."}

::

---

## What Gets Logged

The audit log captures every significant event in the system. Events are categorized by type:

### Execution Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `execution.started`     | Agent began executing a capability                        |
| `execution.completed`   | Capability execution succeeded                            |
| `execution.failed`      | Capability execution failed (includes error details)      |
| `execution.blocked`     | Execution blocked by HITL `block` mode                   |

### HITL Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `hitl.created`          | A HITL request was created                                |
| `hitl.approved`         | A human approved the request                              |
| `hitl.rejected`         | A human rejected the request                              |
| `hitl.escalated`        | Request was escalated to a higher authority               |
| `hitl.timed_out`        | Decision window expired                                   |

### Agent Lifecycle Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `agent.registered`      | New agent was registered                                  |
| `agent.updated`         | Agent fields were modified                                |
| `agent.deactivated`     | Agent was deactivated                                     |
| `agent.transferred`     | Agent ownership transferred to another org                |
| `agent.token_refreshed` | Agent JWT was refreshed                                   |

### Capability Events

| Event Type                   | Description                                          |
|------------------------------|------------------------------------------------------|
| `capability.granted`         | Capability granted to an agent                       |
| `capability.revoked`         | Capability revoked from an agent                     |
| `capability.config_updated`  | HITL mode or other config changed for a capability   |

### Authentication Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `auth.root_key_used`    | Root API key authenticated successfully                   |
| `auth.agent_jwt_issued` | Agent JWT was issued                                      |
| `auth.login`            | Human user logged in (commercial)                         |
| `auth.logout`           | Human user logged out                                     |
| `auth.failed`           | Authentication attempt failed                             |

### Administrative Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `admin.key_rotated`     | Root API key was rotated                                  |
| `admin.user_created`    | New user account created (commercial)                     |
| `admin.user_deleted`    | User account deleted                                      |
| `gdpr.export_requested` | GDPR data export was requested                            |
| `gdpr.erasure_executed` | GDPR data erasure was executed                            |

### LLM Gateway Events

| Event Type              | Description                                               |
|-------------------------|-----------------------------------------------------------|
| `llm.request`           | LLM request sent to provider                              |
| `llm.pii_detected`      | PII was found in LLM request and handled                  |
| `llm.provider_error`    | Upstream LLM provider returned an error                   |

---

## Log Entry Structure

```typescript
interface AuditEntry {
  id: string;               // "aud_01h9k2m3n4p5q6r7s8t9u0v1w2"
  event_type: string;       // "execution.completed"
  agent_id: string | null;  // agent that triggered the event
  user_id: string | null;   // human user involved (if any)
  org_id: string;           // owning organization
  capability: string | null;// capability involved (if applicable)
  execution_id: string | null;
  hitl_request_id: string | null;
  metadata: Record<string, unknown>; // event-specific data
  outcome: "success" | "failure" | "blocked" | "pending";
  prev_hash: string;        // SHA-256 of previous entry (chain link)
  hash: string;             // SHA-256 of this entry's data
  created_at: string;       // ISO 8601 timestamp
}
```

**Example entry — capability execution:**

```json
{
  "id": "aud_01h9k2m3n4p5q6r7s8t9u0v1w2",
  "event_type": "execution.completed",
  "agent_id": "agt_01h9...",
  "user_id": null,
  "org_id": "org_01h9...",
  "capability": "web.search",
  "execution_id": "exec_01h9...",
  "hitl_request_id": null,
  "metadata": {
    "input_summary": "query: EU AI Act compliance checklist",
    "output_summary": "5 results returned",
    "duration_ms": 342,
    "hitl_mode": "auto"
  },
  "outcome": "success",
  "prev_hash": "a3f8c2d1e4b07659f1a2b3c4d5e6f7a8...",
  "hash": "b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4...",
  "created_at": "2024-03-15T10:00:00Z"
}
```

**Example entry — HITL approval:**

```json
{
  "id": "aud_01h9k2...",
  "event_type": "hitl.approved",
  "agent_id": "agt_01h9...",
  "user_id": "usr_01h9...",
  "org_id": "org_01h9...",
  "capability": "email.send",
  "execution_id": null,
  "hitl_request_id": "hitl_01h9...",
  "metadata": {
    "approved_by_email": "alice@acmecorp.com",
    "note": "Approved for Q4 budget communication",
    "decision_time_seconds": 187
  },
  "outcome": "success",
  "prev_hash": "...",
  "hash": "...",
  "created_at": "2024-03-15T10:05:00Z"
}
```

---

## Querying the Audit Log

### List Entries

```bash
# Get the 50 most recent audit entries
curl "http://localhost:3000/api/v1/audit?limit=50" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Filter by event type
curl "http://localhost:3000/api/v1/audit?event_type=hitl.approved" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Filter by agent
curl "http://localhost:3000/api/v1/audit?agent_id=agt_01h9..." \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"

# Filter by date range
curl "http://localhost:3000/api/v1/audit?from=2024-03-01&to=2024-03-31" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY"
```

### Query Parameters

| Parameter      | Type     | Description                                              |
|----------------|----------|----------------------------------------------------------|
| `limit`        | `number` | Max entries to return (default: 50, max: 500)            |
| `offset`       | `number` | Pagination offset                                        |
| `event_type`   | `string` | Filter by event type (e.g. `execution.completed`)        |
| `agent_id`     | `string` | Filter by agent UUID                                     |
| `user_id`      | `string` | Filter by user UUID                                      |
| `capability`   | `string` | Filter by capability name                                |
| `outcome`      | `string` | Filter by outcome: `success`, `failure`, `blocked`       |
| `from`         | `string` | Start date (ISO 8601)                                    |
| `to`           | `string` | End date (ISO 8601)                                      |

### TypeScript SDK

```typescript
import { StorskoClient } from "@storsko/sdk";

const client = new StorskoClient({ apiKey: process.env.STORSKO_ROOT_KEY });

// Get all HITL rejections in the last 30 days
const entries = await client.audit.list({
  eventType: "hitl.rejected",
  from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  limit: 100,
});

for (const entry of entries) {
  console.log(
    `${entry.createdAt}: ${entry.metadata.decided_by_email} rejected ${entry.capability}`
  );
}
```

---

## GDPR Export

Under GDPR Article 15 (right of access), data subjects can request a copy of all data held about them. Storsko provides a dedicated export endpoint that compiles all audit log entries related to a specific user.

```bash
curl "http://localhost:3000/api/v1/audit/:user_id/export" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -o user_data_export.json
```

**Export format:**

```json
{
  "export_id": "export_01h9...",
  "user_id": "usr_01h9...",
  "exported_at": "2024-03-15T12:00:00Z",
  "requested_by": "usr_admin_01h9...",
  "entries": [
    {
      "event_type": "auth.login",
      "created_at": "2024-03-01T09:00:00Z",
      "metadata": { "ip_address": "203.0.113.1", "user_agent": "Mozilla/5.0..." }
    },
    {
      "event_type": "hitl.approved",
      "created_at": "2024-03-01T09:15:00Z",
      "metadata": { "capability": "email.send", "note": "..." }
    }
  ],
  "total_entries": 142
}
```

The export covers:
- All login/logout events for this user
- All HITL decisions made by this user
- All administrative actions performed by this user
- All data modifications attributed to this user

::alert{type="info" title="The export request itself is logged in the audit log as a `gdpr.export_requested` event. This satisfies GDPR Article 12's transparency requirement."}

::

---

## GDPR Data Erasure

Under GDPR Article 17 (right to erasure), users can request deletion of their personal data.

```bash
curl -X DELETE "http://localhost:3000/api/v1/users/:id/data" \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"reason": "User requested erasure under GDPR Article 17"}'
```

### What Gets Erased

| Data                     | Action                                                       |
|--------------------------|--------------------------------------------------------------|
| User profile (name, email, avatar) | Deleted from users table                         |
| Session tokens           | Invalidated immediately                                      |
| Keycloak account         | Deleted from Keycloak realm (commercial only)                |
| Personally identifiable audit metadata | Replaced with `[erased]` placeholder         |

### What Is NOT Erased

| Data                     | Reason                                                       |
|--------------------------|--------------------------------------------------------------|
| Audit log entry hashes   | Required for chain integrity                                 |
| Audit log timestamps     | Required for temporal ordering and compliance reporting      |
| Non-personal event data  | e.g., capability names, execution IDs — not personal data    |
| Anonymized aggregates    | Used for compliance reports and SLA metrics                  |

The erasure operation replaces PII fields in audit metadata (name, email, IP address) with `[erased]` while preserving the structural integrity of the hash chain. The event still exists and the chain remains valid.

::alert{type="warning" title="Erasure is irreversible. Once personal data is erased from audit entries, it cannot be recovered. The `gdpr.erasure_executed` event itself is never erased."}

::

---

## Compliance Use Cases

### EU AI Act

The EU AI Act requires that high-risk AI systems maintain logs sufficient to enable post-incident investigation:

- Storsko logs every execution of every capability, including the input summary and outcome
- High-risk agents (`risk_level: "high"`) have all their executions automatically flagged
- The hash chain ensures logs cannot be retroactively altered to cover up incidents
- Audit entries include the HITL decision trail (who approved, when, why)

See [Compliance](../guides/compliance) for the full EU AI Act documentation.

### SOC2

SOC2 Type II requires evidence of access controls, monitoring, and incident response. The audit log supports:

- **CC6.1 (Logical access controls)**: Every authentication event is logged
- **CC6.2 (Privileged access)**: Admin operations (key rotation, erasure) are logged
- **CC7.2 (System monitoring)**: All agent activity is logged in real time
- **CC7.3 (Incident identification)**: Query audit log to reconstruct any incident

### GDPR

| GDPR Requirement           | Storsko Feature                                              |
|----------------------------|--------------------------------------------------------------|
| Article 13/14 (transparency)| Audit log makes processing visible                          |
| Article 15 (right of access)| `GET /api/v1/audit/:user_id/export`                         |
| Article 17 (right to erasure)| `DELETE /api/v1/users/:id/data`                            |
| Article 22 (automated decisions)| HITL decisions by humans are logged                    |
| Article 30 (records of processing)| Audit log serves as processing record               |

---

## Retention Policies

### Default Retention

By default, audit log entries are retained indefinitely. This is the safest option for compliance.

### Configuring Retention

```bash
# Set retention to 2 years (730 days)
curl -X PATCH http://localhost:3000/api/v1/settings/audit \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 730}'
```

When retention is configured, entries older than the retention period are:
1. Exported to cold storage (S3 or GCS) before deletion
2. Deleted from the primary database
3. The deletion is logged as an `admin.audit_retention_sweep` event

::alert{type="warning" title="Once entries are swept to cold storage, they are no longer queryable via the API. Ensure you have a process to query cold storage archives if needed for compliance investigations."}

::

### EU AI Act Retention Requirement

The EU AI Act requires high-risk AI system logs to be retained for a minimum of 10 years from the date the system was last used. Configure retention accordingly for systems containing high-risk agents:

```bash
curl -X PATCH http://localhost:3000/api/v1/settings/audit \
  -H "Authorization: Bearer $STORSKO_ROOT_KEY" \
  -H "Content-Type: application/json" \
  -d '{"retention_days": 3650}'  // 10 years
```

---

## Related Pages

- [Authentication](./authentication) — auth events are logged
- [Capabilities](./capabilities) — every capability execution is logged
- [Human-in-the-Loop](./hitl) — HITL decisions are logged
- [Compliance](../guides/compliance) — GDPR export, erasure, EU AI Act details
