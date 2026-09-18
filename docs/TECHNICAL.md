# Technical documentation

How Academistream is built, how the main flows work, how to run it, and how it is meant to scale.

---

## 1. Goal

A multi-tenant B2B product where companies train employees with private video:

- **Tenant isolation** — one org cannot see another’s users or media
- **Roles** — platform admin, tenant admin, instructor, learner
- **Content library** — courses + videos, upload, process, publish
- **Training** — assign published videos to learners; track progress and completions
- **Org tools** — invites, members, quotas, audit, CSV export
- **Optional AWS media path** — S3 + MediaConvert when you want a real transcoding pipeline

The hosted demo stays on **local disk storage** so it is cheap to leave online with wake/idle stop.

---

## 2. Architecture (today)

```
Browser (apps/web)
    │  /api → Vite proxy (dev) or Caddy (hosted)
    ▼
Nest API (apps/api)  ──Postgres──  Worker (apps/worker)
    │ Kafka: video.processing          │
    │ Redis: login rate limits         │ MediaConvert poll (when s3)
    ▼                                  ▼
Storage: local disk  or  S3 (+ optional CloudFront)
```

| Piece | Role |
|-------|------|
| `apps/web` | SPA: library, training, org, notifications |
| `apps/api` | Auth, CRUD, upload, playback URLs, quotas, audit |
| `apps/worker` | Consumes Kafka jobs; local ready-check or MediaConvert |
| Postgres | Source of truth (Drizzle schema in `packages/db`) |
| Kafka | Decouples upload from processing |
| Redis | Login rate limiting only |
| Cloudflare Worker | Wake EC2, idle stop, proxy when running |

---

## 3. Monorepo layout

| Path | Package | Notes |
|------|---------|--------|
| `apps/api` | `@academistream/api` | Nest HTTP |
| `apps/worker` | `@academistream/worker` | Nest, no public HTTP surface |
| `apps/web` | `@academistream/web` | React + RTK Query |
| `packages/db` | `@academistream/db` | Schema + `Db` client |
| `packages/shared` | `@academistream/shared` | `resolveStorageRoot`, `LocalMailerService` |
| `infra/terraform` | — | S3, IAM, MediaConvert role, optional CloudFront |
| `infra/wake-worker` | — | Demo cost control at the edge |

Migrations and seed live under `apps/api` (`npm run db:migrate`, `db:seed`).

---

## 4. Tenancy and auth

- Users link to tenants via `tenant_memberships` (unique user + tenant).
- JWT carries `sub`, `username` (display name), `isPlatformAdmin`, and `roles[]` (`tenantId` + `role`).
- Tenant-scoped queries use **JWT tenant id**, not a client-supplied tenant id alone.
- Cross-tenant → **403** (no membership) or **404** (resource not in tenant).
- Platform admins are global (provision tenants); they are not expected to call member-only routes like `GET /tenants/me`.
- Access token in memory (web); refresh via HttpOnly `refresh_token` cookie.
- Login is rate-limited in Redis (per IP and per email).

Roles used in the product UI: `tenant_admin`, `instructor`, `learner` (plus platform admin for ops APIs).

---

## 5. Main product flows

### Content

1. Staff create a **course**, then create a **video** and **upload** multipart (default max 50MB).
2. API writes object via storage adapter, sets `mediaStatus = queued`, produces Kafka `video.processing`.
3. Worker sets `processing`, then:
   - **local:** checks file on disk → `ready` + `playback_key`
   - **s3:** submits MediaConvert; poller marks `ready` / `failed`
4. Staff **publish** when ready. Learners only play published content.
5. Playback: `GET /videos/:id/playback` → short-lived URL (signed `/api/local-media`, S3 presigned, or CloudFront).

UI status labels are the same in both modes (`queued` → `processing` → `ready`). On the hosted demo, “processing” is **not** MediaConvert.

### Training

- Staff assign a **published + ready** video to a **learner** in the same tenant.
- Learners watch (progress from player and/or manual %), complete at ≥ 90%.
- Admins/instructors see tenant progress and completions; CSV export for admins.

### Org

- Invites (token shown once, 7-day expiry, local/console mailer).
- Members list/remove (cannot remove last `tenant_admin`).
- Quotas: `maxUsers` / `maxVideos` (null = unlimited); enforced on invite accept and video create.
- Audit events are best-effort and never block the primary write.

---

## 6. Media modes

| | Local (default + hosted demo) | AWS |
|--|-------------------------------|-----|
| `STORAGE_PROVIDER` | `local` | `s3` |
| Bytes | `STORAGE_LOCAL_ROOT` (shared by API + worker) | S3 bucket |
| Process | File exists → ready | MediaConvert + poller |
| Playback | Signed HTTPS `/api/local-media` when `WEB_ORIGIN` + `JWT_SECRET` set | S3 presigned or CloudFront signed |

**Switch to AWS:** Terraform apply → put outputs in `.env` → set `STORAGE_PROVIDER=s3`, `AWS_REGION`, `S3_BUCKET`, `MEDIACONVERT_ROLE` on **API and worker** → restart both. Optional `CLOUDFRONT_*`. See `infra/terraform/README.md` and `.env.aws.example`.

**Switch back to local:** `STORAGE_PROVIDER=local`, keep `STORAGE_LOCAL_ROOT` + `WEB_ORIGIN`, restart. No MediaConvert charges.

Cost notes when on AWS: MediaConvert bills per output minute; use short clips while developing; tear down unused objects when done.

---

## 7. Hosted demo and wake

- Public site: Cloudflare Worker in front of EC2 + Elastic IP.
- `?wake=<token>` starts the instance (or redirects when already running).
- Proxy uses EC2 `running`/`pending` (does not wait forever on `/api/health`).
- Cron / idle logic stops the instance after ~20 minutes without page visits.
- Details: `infra/wake-worker/README.md`.

Demo media stays **local** on the box by design.

---

## 8. Local development

**Prerequisites:** Node 20+, Docker Desktop (Postgres, Redis, Kafka).

```bash
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate -w @academistream/api
npm run db:seed
npm run api:dev      # :3000
npm run worker:dev
npm run web:dev      # :5173
```

Compose Postgres uses host `5432`. If a Windows PostgreSQL service also binds `5432`, stop it so `DATABASE_URL` hits Docker.

Seed password: `SEED_PASSWORD` / default `Password123!`  
Accounts: `admin@acme.local`, `instructor@acme.local`, `learner@acme.local` (and Globex + platform admin — see seed).

Tests: unit (`npm test`), integration (`npm run test:integration`), demo e2e (`npm run test:demo-e2e`).

---

## 9. Scale path

**Current (prototype / demo):** EC2 + Docker Compose for api, worker, web, Postgres, Kafka, Redis. Optional AWS media when `STORAGE_PROVIDER=s3`.

**Next when load or uptime requires it:**

1. **ECS** (or similar) for `api` and `worker` as separate services  
2. **RDS** PostgreSQL  
3. Later: MSK (Kafka), ElastiCache (Redis)  
4. Same container images; change hosting and connection strings  

Keep monthly cost low while the product spine is stable; move data and messaging to managed services when idle-stop EC2 is no longer enough.

---

## 10. Environments

Config targets: `local`, `uat`, `prod` (see `.env.example`).  
Refresh cookie: HttpOnly, SameSite=Strict; `Secure` only when `NODE_ENV=production`.
