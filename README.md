# Academistream

B2B private training-video platform. Customer companies get their own org, users, and private videos.

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

**Redis:** used by the API for **login rate limiting** (`REDIS_URL`, Compose host port `16379`). Without Redis the API will not start.

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

Auth and isolation tests are **unit tests with Jest mocks** — no real Postgres, Redis, or Kafka in CI.

| Area | Approach |
|------|----------|
| Auth controller | Mock `AuthService` (`useValue`) |
| Auth service | Real `AuthService`; mock `UsersService`, `JwtService`, and `bcrypt.compare` |
| RolesGuard | Instantiate guard with mocked `Reflector`; fake `ExecutionContext` + JWT payload |
| Tenant isolation | Controller uses JWT `roles[].tenantId` (Acme ≠ Globex); service `getMe(tenantId)` with mocked Drizzle |

Run: `npm test -w @academistream/api` (also in CI). Integration / demo e2e against real Postgres (Kafka mocked) run as `npm run test:integration` and `npm run test:demo-e2e` — CI starts Postgres + Redis, migrates, and seeds first.

Seed is idempotent (re-run skips existing emails). Seed tenants get demo-tight quotas by default (`SEED_MAX_USERS=20`, `SEED_MAX_VIDEOS=8`) and those limits are **re-applied** on each seed. Dev accounts (password from `SEED_PASSWORD` in `.env`, default `Password123!`):

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

**Web auth:** Vite proxies `/api` → API (`localhost:3000`). Access token stays in Redux memory; refresh uses the HttpOnly cookie (`credentials: 'include'`). Seed users: see Tenancy section above. Login is rate-limited via Redis (default 10 attempts / IP / minute and 5 / email / minute).

After login, staff land on the **content library** (`/`): list courses/videos, create+upload a file (max **50MB** by default — `UPLOAD_MAX_BYTES`), poll `mediaStatus`, and fetch a playback URL when `ready`. Learners are directed to **My training** (`/training`). Profile is at `/me`. Use a tenant admin or instructor for library upload (learners cannot list/upload).

`/training`: staff assign published ready videos to learners; learners watch, report watch `%` (completion at ≥ 90%), and mark complete; admins see tenant progress/completions. Assignment target is **video** (not course).

`/org`: tenant admin invites (raw token shown once; 7-day expiry; local mailer, not SES), members list/remove (cannot remove last `tenant_admin`), completions CSV download, and audit event list. Instructors can list audit events. Public `/accept-invite` accepts a token (+ name/password for new users).

**Audit actions (best-effort, never blocks the primary write):** `assignment.created`, `completion.created`, `video.published`, `invite.created`, `invite.accepted`, `invite.revoked`, `membership.removed`. Login success is not audited in v1.

### Notifications & quotas

In-app notifications (`notifications` table) for assignment, invite, completion, and media-failure events. Email uses a local/console mailer (`apps/api/src/mail`); swap in SES behind the same `MAIL` adapter when you verify a domain.

- `GET /notifications` — current user's inbox (JWT tenant + user); `PATCH /notifications/:id/read`, `PATCH /notifications/read-all`
- `GET /quotas/usage` — tenant admin/instructor: limits (`maxUsers`, `maxVideos`; **null = unlimited**) vs current member/video counts
- `PATCH /tenants/:id/quotas` — platform admin only
- Enforcement: invite accept (new membership) and **video create** call `QuotasService` (4xx when at limit)

**Web demo:** `/notifications` inbox; `/org` shows quota usage for tenant admins (instructors see quotas too). Trigger notifications by assigning training, inviting a user, completing a video, or failing worker processing. Platform admin can change limits via API: `PATCH /tenants/:id/quotas` with `{ "maxUsers": 5, "maxVideos": 2 }`. Seeded demo tenants default to 20 users / 8 videos.

### Media storage

Object bytes go through a storage adapter (`apps/api/src/storage`). **Default: local disk** (`STORAGE_PROVIDER=local`, `STORAGE_LOCAL_ROOT=.data/media` under the monorepo root — API and worker share the same path).

**AWS S3:** set `STORAGE_PROVIDER=s3` with `S3_BUCKET` and `AWS_REGION` (from `infra/terraform` outputs; see `infra/terraform/README.md`). Uploads use `PutObject`; playback uses S3 presigned GET unless CloudFront is configured.

**CloudFront playback (optional):** set `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, and `CLOUDFRONT_PRIVATE_KEY_PATH` for signed CDN URLs (distribution must use OAC to the private bucket — see `infra/terraform/README.md`). Without CloudFront vars, playback falls back to S3 presigned or local `file://` URLs.

### Video upload + Kafka + worker

`POST /videos/:id/upload` accepts multipart field `file` (rejected over `UPLOAD_MAX_BYTES`, default 50 MiB), writes via the storage adapter, sets `mediaStatus` to `queued`, then produces a job to Kafka topic `video.processing` (`KAFKA_VIDEO_TOPIC`; brokers `KAFKA_BROKERS=localhost:29092`). Payload: `{ videoId, tenantId, storageKey }`.

`npm run worker:dev` runs the consumer: it updates the same Postgres (`DATABASE_URL`) via `@academistream/db`, sets `processing`, then either **submits MediaConvert** (`STORAGE_PROVIDER=s3`) and stores `mediaconvert_job_id`, or on **local disk** checks the file exists and sets `ready` + `playback_key`. A worker **poll loop** (`GetJob`, default every 15s) marks AWS jobs `ready` with the transcoded `playback_key` or `failed`. SNS/EventBridge completion is the documented scale path (see `docs/engineering/SCALE_PATH.md`).

`GET /videos/:id/playback` returns a short-lived URL (`{ url, expiresIn: 3600 }`) for `ready` videos — local `file://`, S3 presigned, or **CloudFront signed** when `CLOUDFRONT_*` env vars are set. Uses `playbackKey` when present (transcoded output). Learners may only play `published` content; admin/instructor can play drafts. Cross-tenant and not-ready → 4xx.

The library page (`/`) polls video list every **2 seconds** while any video is `queued` or `processing`, then stops when all are `ready` or `failed`. Click **Play** on a ready video to fetch the signed URL; HTTPS URLs (S3/CloudFront) play inline in `<video>`; local `file://` URLs show a path hint only (browser security).

### Demo: local vs AWS

#### Local path (default — dev / CI)

1. `cp .env.example .env` — keep `STORAGE_PROVIDER=local`.
2. `docker compose up -d`, migrate, seed.
3. Run API, worker, and web (`npm run api:dev`, `npm run worker:dev`, `npm run web:dev`).
4. Sign in as `instructor@acme.local`, open `/`, create course + upload a small MP4.
5. **Status flow:** `queued` → `processing` (brief) → `ready` (worker checks file on disk under `.data/media`).
6. Publish the video (API), then **Play** — playback URL is `file://` (not inline in browser; path shown on page).

#### AWS path (S3 + MediaConvert + optional CloudFront)

**Prerequisites:** AWS credentials with S3 + MediaConvert + `iam:PassRole` on the MediaConvert role. See `infra/terraform/README.md`.

| Step | Action |
|------|--------|
| 1 | `cd infra/terraform && terraform apply` |
| 2 | Copy outputs into `.env` (or merge from `.env.aws.example`) |
| 3 | Set **`STORAGE_PROVIDER=s3`** on **both API and worker** (same `.env` or process env) |
| 4 | Set `AWS_REGION`, `S3_BUCKET`, `MEDIACONVERT_ROLE` |
| 5 | *(Optional)* CloudFront: OAC distribution + `CLOUDFRONT_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY_PATH` |
| 6 | Restart API + worker after env changes |
| 7 | Upload via `/` — **status flow:** `queued` → `processing` → `ready` (worker submits MediaConvert; poller completes in ~15s–minutes depending on file size) |
| 8 | **Play** on library page — inline MP4 from S3 presigned or CloudFront signed URL |

**`mediaStatus` reference**

| Status | Meaning |
|--------|---------|
| `queued` | Uploaded; Kafka job not yet consumed or worker starting |
| `processing` | Worker running (local file check or MediaConvert job in flight) |
| `ready` | Playback allowed; `playback_key` set (transcoded output on AWS, source key on local) |
| `failed` | Processing error; tenant staff notified — see `/notifications` |

**Cost cautions (real AWS)**

- **MediaConvert** bills per output minute — use short test clips while developing.
- **S3** storage for source + transcoded MP4 under `tenants/{id}/videos/{id}/`.
- **Egress** if clients download/play via S3 presigned URLs; CloudFront can reduce origin egress but has its own pricing.
- Tear down test objects or destroy the Terraform stack when not experimenting.

See also: `.env.aws.example` for a copy-paste AWS env block.

## Environments

Config targets: `local`, `uat`, `prod` (see `.env.example`). Prototype hosting: EC2 + Docker for app + Postgres/Kafka/Redis (Redis backs login rate limits). Scale path: see `docs/engineering/SCALE_PATH.md`.

The refresh_token cookie is HttpOnly and SameSite=Strict.
Secure is on only when NODE_ENV=production, so local HTTP (localhost) still receives the cookie. In production, serve the API over HTTPS so the cookie is only sent on TLS.
