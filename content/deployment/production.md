---
title: "Production Deployment"
description: "Production checklist, nginx reverse proxy, zero-downtime deploys, migrations, monitoring, and security hardening."
sidebar_order: 15
---

## Pre-flight checklist

- [ ] `ROOT_API_KEY` set to a securely generated value (64 hex chars)
- [ ] `JWT_SECRET` set to ≥ 32 random chars, not `changeme`
- [ ] `DATABASE_URL` points to a managed Postgres instance (RDS, Cloud SQL, Supabase, etc.)
- [ ] TLS termination at reverse proxy or load balancer
- [ ] Backups configured on the database
- [ ] `NODE_ENV=production` set

## Reverse proxy (nginx)

```nginx
server {
    listen 443 ssl;
    server_name app.yourdomain.com;

    ssl_certificate     /etc/ssl/certs/yourdomain.crt;
    ssl_certificate_key /etc/ssl/private/yourdomain.key;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Zero-downtime deploys

Use Docker's rolling update strategy:

```bash
docker-compose pull
docker-compose up -d --no-deps --build api-server
docker-compose up -d --no-deps --build web
```

Or with a container orchestrator (Kubernetes, Fly.io, Railway), set `replicas: 2` and use a rolling update policy.

## Migrations

Always run migrations before restarting the application:

```bash
docker-compose run --rm api-server node dist/migrate.js
```

## Monitoring

The `/health` endpoint is suitable for uptime monitors and load-balancer health checks.

For metrics, the api-server emits structured JSON logs consumable by any log aggregation stack (Loki, Datadog, CloudWatch).

## Security hardening

- Bind `api-server` to `127.0.0.1` (not `0.0.0.0`) if behind a reverse proxy.
- Rotate `ROOT_API_KEY` and `JWT_SECRET` with zero-downtime using a key-overlap window.
- Enable Postgres SSL (`sslmode=require` in `DATABASE_URL`).
