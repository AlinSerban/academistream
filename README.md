# Academistream

B2B private training-video platform. Customer companies get their own org, users, and private videos.

**Backlog:** [Trello — Academistream](https://trello.com/b/NjB5lBuC/academistream)

## Apps

| Path | Package | Role |
|------|---------|------|
| `apps/api` | `@academistream/api` | NestJS HTTP API |
| `apps/worker` | `@academistream/worker` | Background / Kafka worker (no HTTP) |
| `apps/web` | `@academistream/web` | React (Vite) + TypeScript |

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis, Kafka)

**Port note:** Compose Postgres uses host `5432`. If a Windows PostgreSQL service is also bound to `5432`, stop it (or set startup to Manual) so `DATABASE_URL` hits Docker, not the local install.

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
```

DB migrations (API / Drizzle):

```bash
npm run db:generate -w @academistream/api
npm run db:migrate -w @academistream/api
npm run db:seed
```

ORM/migrations: Drizzle in `apps/api`.

Tenancy: users belong to tenants via `tenant_memberships` (unique user + tenant). Platform admins use `users.is_platform_admin` and may have no membership row.

Seed is idempotent (re-run skips existing emails/tenants). Dev accounts (password from `SEED_PASSWORD` in `.env`, default `Password123!`):

- Platform admin: `platform@academistream.local` (no tenant membership)
- Acme: `admin@acme.local`, `instructor@acme.local`, `learner@acme.local`
- Globex: `admin@globex.local`, `instructor@globex.local`, `learner@globex.local`

To reset local data: drop the Postgres volume, then `docker compose up -d`, migrate, and seed again. Do not use these passwords in production.

Run apps (separate terminals):

```bash
npm run api:dev
npm run worker:dev
npm run web:dev
```

- API health: http://localhost:3000/health  
- Web: http://localhost:5173  

## Environments

Config targets: `local`, `uat`, `prod` (see `.env.example`). Prototype hosting: EC2 + Docker for app + Postgres/Kafka/Redis. Scale path: see `docs/engineering/SCALE_PATH.md`.

The refresh_token cookie is HttpOnly and SameSite=Strict.
Secure is on only when NODE_ENV=production, so local HTTP (localhost) still receives the cookie. In production, serve the API over HTTPS so the cookie is only sent on TLS.