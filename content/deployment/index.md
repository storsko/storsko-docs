---
title: "Docker Compose"
description: "Run the full Storsko stack with Docker Compose — services, environment variables, migrations, and health checks."
sidebar_order: 14
icon: "lucide:container"
---

Storsko Core ships with a `docker-compose.yml` for running the full stack locally or in production.

## Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | `5432` | PostgreSQL 16 — primary database |
| `api-server` | `3000` | Storsko Core REST API |
| `web` | `3001` | Next.js web dashboard |

## Quick start

```bash
cd storsko-core
cp .env.example .env
make setup
make dev-infra   # starts postgres
make dev         # starts api-server + web
```

## Environment variables

Copy `.env.example` to `.env` and set:

```env
POSTGRES_PASSWORD=changeme_local
ROOT_API_KEY=storsko_root_<64 random hex chars>
JWT_SECRET=<at least 32 random chars>
DATABASE_URL=postgres://storsko:changeme_local@localhost:5432/storsko
```

Generate a root key:

```bash
node -e "console.log('storsko_root_' + require('crypto').randomBytes(32).toString('hex'))"
```

## Running migrations

```bash
make migrate
```

This applies all pending SQL migrations from `packages/api-server/migrations/`.

## Health check

```bash
curl http://localhost:3000/health
# {"status":"ok"}
```

## Custom compose override

Create `docker-compose.override.yml` to extend the base compose without modifying the checked-in file:

```yaml
services:
  api-server:
    environment:
      LOG_LEVEL: debug
```
