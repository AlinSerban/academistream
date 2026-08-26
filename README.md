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

ORM/migrations: Drizzle schema lives in `@academistream/db` (`packages/db`); migrate/seed scripts stay in `apps/api`.

### Tenancy & isolation

Users belong to tenants via `tenant_memberships` (unique user + tenant). Platform admins use `users.is_platform_admin` and may have no membership row.

**Isolation convention:** tenant-scoped API queries use `tenantId` from the authenticated principal (JWT memberships on `request.user`), not a client-supplied tenant id alone. Cross-tenant access returns **403** (no membership) or **404** (resource not found for that tenant). Platform admins are **global** — not tenant-scoped; they provision tenants and are not expected to call tenant-member routes like `GET /tenants/me` (that returns 403 when there is no membership).

Sample check: `GET /tenants/me` returns `{ id, name, status }` for the caller's first membership tenant.

### Testing strategy (API)

Sprint 1 security tests are **unit tests with Jest mocks** — no real Postgres, Redis, or Kafka in CI.

| Area | Approach |
|------|----------|
| Auth controller | Mock `AuthService` (`useValue`) |
| Auth service | Real `AuthService`; mock `UsersService`, `JwtService`, and `bcrypt.compare` |
| RolesGuard | Instantiate guard with mocked `Reflector`; fake `ExecutionContext` + JWT payload |
| Tenant isolation | Controller uses JWT `roles[].tenantId` (Acme ≠ Globex); service `getMe(tenantId)` with mocked Drizzle |

Run: `npm test -w @academistream/api` (also in CI). A transactional test DB / Supertest e2e layer is out of scope for S1-08; add later if integration coverage is needed.

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

Web login (S1-09): Vite proxies `/api` → API (`localhost:3000`). Access token stays in Redux memory; refresh uses the HttpOnly cookie (`credentials: 'include'`). Seed users: see Tenancy section above.

After login, `/` is the thin content library (S2-08): list courses/videos, create+upload a file, poll `mediaStatus`, and fetch a playback URL when `ready`. Profile is at `/me`. Use a tenant admin or instructor (learners cannot list/upload).

`/training` (S3): assign published ready videos to learners; learners report watch `%` (completion at ≥ 90%); admins see tenant progress/completions. Assignment target is **video** (not course).

`/org` (S4): tenant admin invites (raw token shown once; 7-day expiry; no SES), members list/remove (cannot remove last `tenant_admin`), completions CSV download, and audit event list. Instructors can list audit events. Public `/accept-invite` accepts a token (+ name/password for new users).

**Audit actions (best-effort, never blocks the primary write):** `assignment.created`, `completion.created`, `video.published`, `invite.created`, `invite.accepted`, `invite.revoked`, `membership.removed`. Login success is not audited in this sprint.

### Media storage

Object bytes go through a storage adapter (`apps/api/src/storage`). **Local disk** is active (`STORAGE_LOCAL_ROOT`, default `.data/media` under the **monorepo root** — both API and worker resolve relative paths from the repo root so they share the same files). S3 is documented as commented SDK-shaped code next to the local methods; set `S3_BUCKET` / `AWS_REGION` in `.env` only when you switch the provider later — they are unused today.

### Video upload + Kafka + worker

`POST /videos/:id/upload` accepts multipart field `file`, writes via the storage adapter, sets `mediaStatus` to `queued`, then produces a job to Kafka topic `video.processing` (`KAFKA_VIDEO_TOPIC`; brokers `KAFKA_BROKERS=localhost:29092`). Payload: `{ videoId, tenantId, storageKey }`.

`npm run worker:dev` runs the consumer: it updates the same Postgres (`DATABASE_URL`) via `@academistream/db`, sets `processing`, checks the file exists, then `ready` or `failed`. Real MediaConvert is commented next to that stub.

`GET /videos/:id/playback` returns a short-lived local URL (`{ url, expiresIn }`) for `ready` videos in the caller’s tenant. Learners may only play `published` content; admin/instructor can play drafts too. Cross-tenant and not-ready → 4xx. CloudFront/S3 signed GET is commented next to the local storage stub.

## Environments

Config targets: `local`, `uat`, `prod` (see `.env.example`). Prototype hosting: EC2 + Docker for app + Postgres/Kafka/Redis. Scale path: see `docs/engineering/SCALE_PATH.md`.

The refresh_token cookie is HttpOnly and SameSite=Strict.
Secure is on only when NODE_ENV=production, so local HTTP (localhost) still receives the cookie. In production, serve the API over HTTPS so the cookie is only sent on TLS.