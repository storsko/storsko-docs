---
title: "Installation"
description: "Install Storsko Core from source — prerequisites, database setup, environment variables, and first run."
sidebar_order: 2
icon: "lucide:download"
---

This guide walks you through installing Storsko Core from source. If you want to use the managed commercial platform instead, see [Commercial Platform](../commercial/).

---

## Prerequisites

Before installing Storsko, ensure your environment meets the following requirements.

### Required

| Dependency | Minimum Version | Notes |
|---|---|---|
| Node.js | 20.x | LTS recommended. Use [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm) to manage versions. |
| pnpm | 9.x | Install with `npm install -g pnpm` |
| PostgreSQL | 15.x | Local install or any hosted provider (Supabase, Neon, Railway, RDS, etc.) |
| Git | Any recent | For cloning the repository |

### Optional

| Dependency | Notes |
|---|---|
| Docker + Docker Compose | Required only if running via Docker Compose. Recommended for local development. |
| Make | Required for `make setup`, `make dev`, `make build` convenience commands. Pre-installed on Linux/macOS. Windows users can use `nmake` or run the underlying commands directly. |

### Verifying Prerequisites

```bash
node --version     # should print v20.x.x or higher
pnpm --version     # should print 9.x.x or higher
psql --version     # should print psql (PostgreSQL) 15.x or higher
docker --version   # optional: should print Docker version 24.x or higher
```

---

## Clone the Repository

```bash
git clone https://github.com/storsko/storsko-core.git
cd storsko-core
```

---

## Install Dependencies

Storsko uses pnpm workspaces (Turborepo). A single install at the root installs all package dependencies:

```bash
pnpm install
```

This will install dependencies for all packages in the monorepo:
- `packages/api-server`
- `packages/sdk`
- `packages/auth`
- `packages/capability-registry`
- `packages/execution-adapter`
- `packages/agent-hub`
- `packages/llm-gateway`
- `apps/web`
- `apps/docs`

::alert{type="default" title="First Install"}
The first `pnpm install` may take 1-2 minutes as it downloads all dependencies. Subsequent installs use the pnpm store cache and are much faster.
::

---

## Database Setup

Storsko requires a PostgreSQL 15+ database. You can set one up locally or use a hosted provider.

### Option A: Local PostgreSQL

If you have PostgreSQL installed locally, create a database and user:

```bash
# Connect to PostgreSQL as the superuser
psql -U postgres

# Create the Storsko user and database
CREATE USER storsko WITH PASSWORD 'storsko';
CREATE DATABASE storsko OWNER storsko;
GRANT ALL PRIVILEGES ON DATABASE storsko TO storsko;

# Exit psql
\q
```

Your `DATABASE_URL` will be:
```
DATABASE_URL=postgresql://storsko:storsko@localhost:5432/storsko
```

### Option B: Docker PostgreSQL (Recommended for Development)

If you have Docker installed, start a PostgreSQL container:

```bash
docker run -d \
  --name storsko-postgres \
  -e POSTGRES_USER=storsko \
  -e POSTGRES_PASSWORD=storsko \
  -e POSTGRES_DB=storsko \
  -p 5432:5432 \
  postgres:15
```

This is the simplest option for local development. The database is accessible at `localhost:5432`.

### Option C: Hosted PostgreSQL

Any PostgreSQL 15+ provider works. Set `DATABASE_URL` to the connection string provided by your hosting service.

Popular options for development:
- [Neon](https://neon.tech) — serverless PostgreSQL, generous free tier
- [Supabase](https://supabase.com) — PostgreSQL with extras, free tier available
- [Railway](https://railway.app) — simple hosted PostgreSQL

---

## Environment Variables

Storsko reads configuration from environment variables. The `make setup` command (described below) generates a `.env` file for you, but you can also create it manually.

Create a file called `.env` in the repository root:

```bash
# .env

# Database
DATABASE_URL=postgresql://storsko:storsko@localhost:5432/storsko

# Auth (leave empty — make setup will generate these)
ROOT_API_KEY_SECRET=
JWT_SECRET=
JWT_EXPIRES_IN=7d

# API Server
PORT=3000
NODE_ENV=development

# LLM Gateway (optional — only needed if using /api/v1/llm/chat)
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
```

::alert{type="warning" title="Security"}
Never commit `.env` to version control. The repository includes `.env` in `.gitignore` by default.
::

For a full reference of all environment variables, see [Configuration](./configuration/).

---

## Running `make setup`

The `make setup` command performs first-time setup in a single step:

1. Creates `.env` from `.env.example` (if `.env` does not exist)
2. Generates a cryptographically random `ROOT_API_KEY_SECRET`
3. Generates a cryptographically random `JWT_SECRET`
4. Runs all database migrations (via Drizzle ORM)
5. Prints your root API key to the console

```bash
make setup
```

Expected output:

```
[storsko] Running database migrations...
[storsko] Migrations complete.
[storsko] Generated ROOT_API_KEY_SECRET → written to .env
[storsko] Generated JWT_SECRET → written to .env
[storsko] Root API key: storsko_root_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
[storsko] Setup complete. Run `make dev` to start the development server.
```

::alert{type="danger" title="Save Your Root API Key"}
The root API key is printed once during `make setup`. Copy it now and store it securely. If you lose it, run `make reset-root-key` to generate a new one (this invalidates the old key).
::

---

## Running with Docker Compose

For a fully containerised local development environment, use Docker Compose:

```bash
# Start all services (PostgreSQL, API server, web dashboard)
docker compose up -d

# Check service status
docker compose ps

# Follow logs
docker compose logs -f
```

The Docker Compose file starts:
- `postgres` — PostgreSQL 15 on port 5432
- `api` — Fastify API server on port 3000
- `web` — Next.js web dashboard on port 3001

::alert{type="info" title="First Run with Docker Compose"}
On first run, Docker Compose will build the API and web images. This takes 2-5 minutes depending on your machine. Subsequent starts use the cached layers and are much faster.
::

To stop all services:

```bash
docker compose down
```

To stop and remove all data (including the PostgreSQL volume):

```bash
docker compose down -v
```

---

## Starting the Development Server

If you are not using Docker Compose, start the development server with:

```bash
make dev
```

Or equivalently:

```bash
pnpm dev
```

This runs all packages in watch mode using Turborepo. The following services start:

| Service | URL | Notes |
|---|---|---|
| API server | http://localhost:3000 | Fastify REST API |
| Web dashboard | http://localhost:3001 | Next.js 15 |
| Docs | http://localhost:3002 | Docusaurus |

---

## Verifying the Installation

### Health Check

The API server exposes a health check endpoint:

```bash
curl http://localhost:3000/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "version": "0.1.0",
  "db": "connected",
  "timestamp": "2026-03-30T12:00:00.000Z"
}
```

### Authenticated Request

Test your root API key by listing agents:

```bash
curl -H "x-api-key: storsko_root_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" \
  http://localhost:3000/api/v1/agents
```

Expected response:

```json
{
  "agents": [],
  "total": 0
}
```

An empty array is correct — you have not registered any agents yet.

---

## Troubleshooting

### `pnpm install` fails with permission errors

Ensure you are not running pnpm as root. If you installed Node.js globally as root, consider reinstalling with `nvm` or `fnm` as a regular user.

### `make setup` fails with `connection refused` on PostgreSQL

Verify PostgreSQL is running and accessible:

```bash
psql postgresql://storsko:storsko@localhost:5432/storsko -c "SELECT 1"
```

If this fails, check:
1. PostgreSQL is running: `pg_ctl status` or `systemctl status postgresql`
2. The port is correct: PostgreSQL defaults to 5432
3. The credentials match what you created in the database setup step

### `make setup` fails with `role "storsko" does not exist`

You did not create the PostgreSQL user before running setup. Follow the [Database Setup](#database-setup) section and then re-run `make setup`.

### Port 3000 already in use

Another process is using port 3000. Either stop the conflicting process or change the `PORT` environment variable:

```bash
PORT=3100 make dev
```

### Web dashboard shows a blank page

The web dashboard (`apps/web`) requires `NEXT_PUBLIC_API_URL` to point at the API server. In development this defaults to `http://localhost:3000`. If you changed the API port, update `NEXT_PUBLIC_API_URL` in your `.env` file.

### Docker Compose: images fail to build

Ensure Docker has at least 4 GB of memory available. On Docker Desktop, go to Settings → Resources → Memory and increase the limit.

### Migrations fail with `relation already exists`

Your database already has tables from a previous setup. If you want to start fresh:

```bash
# Drop and recreate the database
psql -U postgres -c "DROP DATABASE storsko;"
psql -U postgres -c "CREATE DATABASE storsko OWNER storsko;"
make setup
```

::alert{type="warning" title="Dropping the database deletes all data. Only do this in development."}

::

---

## Next Steps

- [Quick Start](./quick-start/) — register your first agent and make a governed execution
- [Configuration](./configuration/) — full environment variable reference
- [Docker Deployment](../deployment/) — production-ready Docker setup
