---
title: "Introduction"
description: "What Storsko is, the problems it solves, key features, and how it compares across OSS and commercial tiers."
sidebar_order: 1
icon: "lucide:info"
---

Storsko is an **enterprise governance layer for AI agent runtimes**. It sits between your application code and your AI agents, enforcing capability-based access control, human-in-the-loop (HITL) workflows, and a tamper-proof audit trail — without requiring you to rewrite your agents.

::alert{type="info" title="Open Source"}
Storsko Core is AGPL-3.0 open source and fully self-hostable. The commercial platform at [app.storsko.com](https://app.storsko.com) adds managed hosting, multi-tenancy, Keycloak SSO, and Stripe-based billing.
::

---

## The Problem Storsko Solves

Modern AI agents are powerful. They can write code, send emails, modify databases, call external APIs, and manage infrastructure. That power comes with serious governance challenges:

- **Uncontrolled execution** — agents act without approval for high-stakes operations
- **No audit trail** — you cannot reconstruct what an agent did, when, and why
- **Capability sprawl** — every agent ends up with more permissions than it needs
- **No human escalation path** — when an agent reaches a decision boundary, there is no structured way to pause and ask a human
- **Compliance exposure** — the EU AI Act, GDPR, SOC 2, and sector-specific regulations increasingly require demonstrable oversight of automated systems

Storsko solves all of these through a **governance chokepoint**: every agent action flows through the `@storsko/execution-adapter` package, which checks capabilities, triggers HITL queues when required, records every event to an append-only audit log, and routes tasks to the right agent or team.

---

## What Storsko Is Not

Storsko is not an agent framework. It does not provide prompt engineering, memory management, or agent orchestration. It is designed to compose with whatever agent runtime you already use — [NemoClaw](https://github.com/nemoclaw), [OpenClaw](https://github.com/openclaw), LangChain, CrewAI, or your own custom stack.

---

## OSS Core vs Commercial Platform

| Feature | OSS Core | Commercial — Personal | Commercial — Teams | Commercial — Enterprise |
|---|---|---|---|---|
| Agent registration | Yes | Yes | Yes | Yes |
| Capability-based access | Yes | Yes | Yes | Yes |
| HITL workflows | Yes | Yes | Yes | Yes |
| Audit log | Yes | Yes | Yes | Yes |
| REST API | Yes | Yes | Yes | Yes |
| TypeScript SDK | Yes | Yes | Yes | Yes |
| Self-hosted | Yes | Yes | Yes | Yes |
| Managed hosting | No | Yes | Yes | Yes |
| Multi-tenancy | No | No | Yes | Yes |
| Teams + delegation | No | No | Yes | Yes |
| Task routing | No | No | Yes | Yes |
| Slack / MS Teams notifications | No | No | Yes | Yes |
| Employee Agent Programme | No | No | Yes | Yes |
| Keycloak SSO (SAML/LDAP) | No | No | No | Yes |
| Custom SLAs | No | No | No | Yes |
| Dedicated support | No | No | No | Yes |
| Compliance reports (EU AI Act) | No | No | No | Yes |
| Agent limit | Unlimited | 5 | Unlimited | Unlimited |
| Price | Free | $29/mo | $99/mo | Custom |

---

## Key Features

### Capability-Based Access Control

Every agent has an explicit set of capabilities: `file:write`, `db:mutate`, `email:send`, `api:call`, and so on. Attempting to use a capability the agent does not have fails at the governance chokepoint with a detailed error. Capabilities can be granted or revoked at runtime without redeploying anything.

### Human-in-the-Loop (HITL)

When an agent attempts a sensitive action — or when the capability configuration requires approval — Storsko pauses execution and places a request in the HITL queue. A human reviewer can approve, reject, or escalate the request. Approval resumes execution. The full decision, including the reviewer's identity, timestamp, and comment, is written to the audit log.

### Append-Only Audit Log

Every event — agent registration, capability grant/revoke, HITL decision, task execution, routing decision — is written to an append-only audit log in PostgreSQL. The audit log supports GDPR export by user ID and GDPR erasure.

### EU AI Act Risk Classification

Each agent can be assigned a risk level under the EU AI Act taxonomy: `minimal`, `limited`, `high`, or `unacceptable`. High-risk agents automatically trigger stricter HITL requirements. Risk levels are stored and exposed in compliance reports (Enterprise tier).

### Task Routing

The routing engine resolves which agent or team should handle a given task based on ownership type, capability requirements, and current availability. The full routing log is retained for audit purposes.

### LLM Gateway

The optional LLM gateway proxies requests to OpenAI and Anthropic, applying PII detection and rate limiting before forwarding. All LLM calls are recorded in the audit log.

---

## Architecture at a Glance

```
 ┌─────────────────────────────────────────────────────────────────┐
 │                         Your Application                        │
 └──────────────────────────────┬──────────────────────────────────┘
                                │
                  @storsko/execution-adapter
                                │
            ┌───────────────────▼───────────────────┐
            │           @storsko/api-server           │
            │              (Fastify REST)             │
            └──┬──────────────┬───────────────┬──────┘
               │              │               │
    ┌──────────▼──┐   ┌───────▼──────┐  ┌────▼──────────┐
    │ @storsko/   │   │  @storsko/   │  │  @storsko/    │
    │ agent-hub   │   │  capability- │  │  llm-gateway  │
    │             │   │  registry    │  │               │
    └──────────┬──┘   └───────┬──────┘  └────┬──────────┘
               │              │               │
            ┌──▼──────────────▼───────────────▼──┐
            │              PostgreSQL              │
            │  agents | capabilities | hitl_reqs  │
            │  audit_log | teams | routing_log    │
            └─────────────────────────────────────┘
```

The `execution-adapter` is the only entry point into the governance stack for agent actions. The Fastify API server exposes REST endpoints consumed by the web dashboard, the TypeScript SDK, and direct HTTP clients. All state lives in PostgreSQL.

---

## Who is Storsko For?

**Platform engineers** building internal AI infrastructure who need a governance layer they can trust, audit, and extend without vendor lock-in.

**AI/ML teams** deploying autonomous agents in production who need human-in-the-loop workflows baked in from day one rather than bolted on later.

**Compliance and legal teams** at organisations subject to the EU AI Act, SOC 2, or sector-specific regulations (financial services, healthcare, public sector) who need demonstrable oversight of automated systems.

**Startups** building AI-native products who want enterprise-grade governance from the start without building it themselves.

**Enterprises** evaluating whether to allow AI agents to act on behalf of employees, who need the Employee Agent Programme and SAML/LDAP integration.

---

## Getting Started

Ready to deploy Storsko? Start here:

1. [Installation](./getting-started/) — prerequisites, clone, database setup, first run
2. [Quick Start](./getting-started/quick-start/) — register an agent, grant capabilities, approve your first HITL request
3. [Configuration](./getting-started/configuration.md) — every environment variable explained
4. [Architecture Overview](./architecture/) — deep dive into how Storsko works
5. [REST API Reference](./api-reference/) — complete endpoint reference
6. [SDK Overview](./sdk/) — TypeScript client reference

If you are evaluating the commercial platform, see [Commercial Platform](./commercial/).

---

## Community and Support

- **GitHub:** [github.com/storsko/storsko-core](https://github.com/storsko/storsko-core)
- **Issues:** Open a GitHub issue for bugs and feature requests
- **Discussions:** GitHub Discussions for questions and community help
- **Commercial support:** See [Commercial Platform](./commercial/) for SLA-backed support options
