# Technical documentation

How Academistream is built, how the main flows work, how to run it, and how it is meant to scale.

## Contents

1. [Goal](#1-goal): product intent and scope
2. [Architecture](#2-architecture-today): runtime pieces and how they talk
3. [Monorepo layout](#3-monorepo-layout): apps, packages, infra paths
4. [Tenancy and auth](#4-tenancy-and-auth): JWT, roles, isolation
5. [Main product flows](#5-main-product-flows): content, training, org
6. [Media modes](#6-media-modes): local disk vs AWS
7. [Hosted demo and wake](#7-hosted-demo-and-wake): start / idle stop
8. [Local development](#8-local-development): install and run
9. [Scale path](#9-scale-path): what to grow next
10. [Environments](#10-environments): config targets

Related: **[Product tour (screenshots)](demo-screenshots/README.md)** · **[README](../README.md)**

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

One repo for the product and demo operations. Apps are the services you run; packages are shared libraries; `infra` holds AWS Terraform and the Cloudflare wake Worker.

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

**List APIs:** tenant collections use `page` + `pageSize` (default 5, max 100) and return `{ items, total, page, pageSize }`. Filters run in SQL (`mediaStatus`, course `q`). Dropdowns use dedicated endpoints (`GET /courses/options`, `GET /videos/assignable`) instead of loading full tables. Learner `GET /assignments/mine` joins progress/completion and returns stats + continue-watching in one response.

### Training

- Staff assign a **published + ready** video to a **learner** in the same tenant.
- Learners watch (progress from player and/or manual %), complete at ≥ 90%.
- Admins/instructors see tenant progress and completions; CSV export for admins.

### Org

- **Invites:** Admin creates an invite (email + role). The API returns a raw token **once** in the response; the UI shows it so you can copy it. Token expires in 7 days. There is no real outbound email: `LocalMailerService` only logs a would-send line to the server console. Invitee joins via `/invites/accept` with that token.
- **Members:** Admins list members and remove people from the tenant. You cannot remove the last `tenant_admin`, so the org is never left without an admin.
- **Quotas:** Per-tenant caps `maxUsers` and `maxVideos`. `null` means unlimited. Checked when someone accepts an invite (new member) and when a video is created. Seeded demo tenants use small limits (see seed).
- **Audit:** Important org/content actions write an audit row. If that insert fails, the primary action still succeeds; the failure is logged only. Audit never blocks invites, uploads, or other writes.
- **CSV export:** Admins can export training progress / completions as CSV from the Organization page.

---

## 6. Media modes

| | Local (default + hosted demo) | AWS |
|--|-------------------------------|-----|
| `STORAGE_PROVIDER` | `local` | `s3` |
| Bytes | `STORAGE_LOCAL_ROOT` (shared by API + worker) | S3 bucket |
| Process | File exists → ready | MediaConvert + poller |
| Playback | Signed HTTPS `/api/local-media` when `WEB_ORIGIN` + `JWT_SECRET` set | S3 presigned or CloudFront signed |

**Switch to AWS (order matters):**

1. **Provision AWS first.** From `infra/terraform`, run `terraform apply`. That creates the S3 media bucket and the IAM role MediaConvert assumes. Until this step succeeds, the app has nothing in your AWS account to talk to.
2. **Copy outputs into `.env`.** Use `terraform output` for `aws_region`, `s3_bucket_name`, and `mediaconvert_role_arn` (see `.env.aws.example` for the variable names). Do not commit the filled `.env`.
3. **Point both processes at S3.** On the **API and the worker**, set `STORAGE_PROVIDER=s3`, `AWS_REGION`, `S3_BUCKET`, and `MEDIACONVERT_ROLE`. Both need the same values; only one side still on `local` will break the pipeline.
4. **Credentials.** The processes must be able to call AWS (CLI profile, `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`, or an EC2 instance role). Those secrets stay outside the repo.
5. **Restart API and worker** so they pick up the new config. Uploads then go to S3; the worker submits MediaConvert jobs and polls until `ready` / `failed`.
6. **Optional CloudFront.** Set `CLOUDFRONT_*` only if you built a signed-playback distribution. Otherwise playback uses S3 presigned URLs.

Details: `infra/terraform/README.md` and `.env.aws.example`.

**Switch back to local:** Set `STORAGE_PROVIDER=local`, keep `STORAGE_LOCAL_ROOT` + `WEB_ORIGIN`, restart API and worker. No MediaConvert charges while on local.

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
