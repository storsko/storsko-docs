---
title: "LLM Gateway"
description: "Unified LLM routing for OpenAI and Anthropic with PII scanning and audit integration."
sidebar_order: 20
---

The LLM Gateway provides a unified routing layer for OpenAI and Anthropic models, with built-in PII scanning and audit integration.

## Overview

Every LLM call made through Storsko passes through the gateway which:

- Routes to the correct provider (OpenAI or Anthropic) based on the model prefix.
- Scans prompts and completions for PII before logging.
- Writes a `llm_call` event to the audit log.

## Configuration

Set your provider keys in the api-server environment:

```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## Making a request

Agents call the gateway via the execution adapter. The gateway endpoint is not exposed publicly — it is called internally during `POST /api/v1/execute`.

## PII scanning

The gateway redacts common PII patterns (email addresses, phone numbers, credit card numbers) from prompt/completion payloads before writing them to the audit log. Raw payloads are never persisted.

## Supported models

| Prefix | Provider |
|--------|----------|
| `gpt-*` | OpenAI |
| `claude-*` | Anthropic |
| `o1-*`, `o3-*` | OpenAI |

## Audit integration

Each gateway call appends to the audit chain:

```json
{
  "event": "llm_call",
  "agent_id": "agent_abc",
  "model": "claude-sonnet-4-6",
  "prompt_tokens": 412,
  "completion_tokens": 85,
  "pii_detected": false
}
```
