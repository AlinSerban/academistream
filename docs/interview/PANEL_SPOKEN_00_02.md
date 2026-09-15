# Panel interview — spoken: framing, architecture, domain

Speak this roughly as written. Sections 0–3 of a longer session (auth, video, behavioral come later). Aim ~50–70 minutes with questions.

Companion docs: `AUTH_RBAC_STAR.md`, `VIDEO_PIPELINE_STAR.md`, `VIDEO_PIPELINE_FLOW.md`.

---

## 0. Framing

Thanks for having me. I’ll start with what we built and why, then walk the architecture and the domain model. After that we can go as deep as you want on auth, the media pipeline, or tradeoffs.

Academistream is a **B2B SaaS** for private training video. Our customers are companies — we call them **tenants**. Inside each tenant you have admins, instructors who upload content, and learners who get assigned videos and watch them. We don’t sell a consumer Netflix clone; we sell **org-scoped, private enablement content**. That drives almost every design choice: multi-tenancy, RBAC, and media that never sits in a public bucket.

Commercially we kept it simple: sales-led, no billing module in the product. Platform admins provision tenants and quotas; tenant admins manage people and content. That was intentional so we could spend depth on identity, isolation, and async media instead of payments.

On the team shape: small team, product-minded engineering. We built a **modular NestJS monorepo** — HTTP API, a background worker, and a React web app — with Postgres, Kafka, and Redis. For media we use AWS S3 and MediaConvert when we want the real path, and a local storage stub for day-to-day and CI. Infra for the media bucket and MediaConvert role is in Terraform.

What’s **in** the spine: auth and tenancy, content library, assignments and progress, invites and org, in-app notifications, quotas, audit events, and the full upload-to-playback pipeline. What’s **deferred on purpose**: in-app billing, MSK, full CloudFront-in-Terraform, SNS completion instead of polling, and ECS. We have a written scale path: stay on EC2 plus Compose while the product is early; move API and worker to ECS and Postgres to RDS when load and uptime justify it.

If I had to say what this project is “about” in one sentence: it’s a believable multi-tenant training platform where the hard parts are **who can see what**, and **getting private video from upload to playable without blocking the request path**.

---

## 1. System design — big picture

Let me draw the boxes the way I’d draw them on a whiteboard.

At the edge we have a **React SPA**. It talks to our **NestJS API** over HTTP — locally Vite proxies `/api` to the API. The browser never talks to Kafka or S3 with long-lived credentials for business writes; uploads go through the API, and playback gets a **short-lived signed URL** after the API checks authz.

The API is the synchronous front door: login, CRUD for courses and videos, upload, playback URL, org, training, quotas. After a successful upload it writes the file through a **storage adapter** — local disk or S3 — updates the video row to `queued`, and **produces a Kafka message**. It does not wait for transcoding. That keeps the HTTP request fast and keeps failure domains separate.

Separately we run a **NestJS worker** with no HTTP server. It has a Kafka consumer on the processing topic. When a job arrives it marks the video `processing` and either submits a **MediaConvert** job or, in local mode, checks the file on disk and marks it ready. For AWS, MediaConvert is asynchronous, so the worker also runs a **poller** that calls `GetJob` every few seconds for rows stuck in processing. On complete we set `ready` and a `playback_key`; on error or cancel we set `failed`. We also publish **media lifecycle events** on a second Kafka topic so notifications are driven by events rather than being hard-wired only inside the poller. That’s the command-versus-event split: one topic means “do the work,” another means “the outcome is known.”

**Postgres** is shared by API and worker via a shared Drizzle schema package. That’s deliberate for a modular monolith: one source of truth for video status, memberships, assignments. **Kafka** is the async boundary. **Redis** is in the compose stack for the broader platform story; the media path doesn’t depend on it for the core upload flow.

On AWS for media: a **private S3 bucket**, public access blocked, tenant-scoped object keys. MediaConvert assumes a dedicated IAM role to read and write that bucket. The API and worker use normal AWS credentials — or an instance role later — and need `iam:PassRole` to hand MediaConvert that role when creating a job. Playback today is typically an **S3 presigned GET**; CloudFront signed URLs are supported in code when env is configured, same private origin idea.

**Sync versus async:** anything the user needs in the next hundred milliseconds stays on the API — auth, list videos, get a playback URL. Anything that can take seconds to minutes — transcode — is async behind Kafka. If the worker is down, uploads can still land in S3 and sit queued until the consumer catches up; that’s a failure mode we can talk about.

**Environments:** local is Docker Compose for Postgres, Kafka, Redis, plus three Node processes. UAT and prod we planned as the same Compose app shape on EC2 with different env and a separate Terraform `environment` for media resources — duplicate stack, not a different architecture. CI runs unit tests and a web build on PRs; deploy automation is the incremental piece, not a prerequisite to explaining the design.

**Scale path in one breath:** same container images; later split API and worker onto ECS so they scale independently; move Postgres to RDS; optionally MSK and ElastiCache when ops cost of Kafka-on-the-box hurts more than managed fees. We didn’t start there because a solo or small team doesn’t need MSK to learn or demo the product spine.

If you ask “why not transcode in the API?” — because then every upload holds a request open, couples web traffic to encode load, and makes retries and idempotency harder. Kafka plus a worker is the boring, correct shape for this problem.

---

## 2. Architecture and design patterns

When they ask what patterns we used, I don’t recite a textbook list — I map each one to a place in the codebase so it sounds concrete.

**Modular monolith.** One product, one Postgres, multiple Nest modules — Auth, Content, Training, Org, Quotas, Notifications, Audit — and a separate worker process that still shares the schema package. We’re not microservices for ego; the process boundary is where the workload differs: sync HTTP versus long-running Kafka and MediaConvert. The monorepo (`apps/api`, `apps/worker`, `apps/web`, `packages/db`) is the delivery shape.

**Ports and adapters — storage.** Callers depend on a `StorageService` interface: `putObject`, `getSignedGetUrl`, `deleteObject`. Nest injects it under a `STORAGE` token. A factory chooses local disk or S3 from `STORAGE_PROVIDER`. Videos service never branches on AWS vs laptop. Same idea for mail: a `MAIL` token with a local mailer today, SES-shaped later. Playback URL is another swap — S3 presign versus CloudFront signed — behind `PlaybackUrlService`. That’s the adapter pattern we actually ship.

**Strategy by config — processing mode.** On the worker, `resolveProcessingMode` returns either “local stub” or “MediaConvert client bundle.” `VideoProcessingService.handle` switches on that mode: check file on disk and mark ready, or `CreateJob` / `CancelJob`. One consumer code path, two strategies selected at boot from env.

**Dependency injection and factories.** Nest’s DI is how adapters are wired — `useFactory` in `StorageModule`, config-driven JWT and DB clients. Controllers stay thin; services own use cases. That’s boring Nest, but it’s why tests swap `STORAGE` and Drizzle with fakes.

**Guard pipeline / chain of responsibility for authz.** Globally: `JwtAuthGuard`, then `RolesGuard`. Routes opt out with `@Public()`, or declare `@Roles(...)`. Metadata via Reflector. Authn and authz are separate steps; controllers don’t re-check JWT. Tenant isolation is the next layer inside services: filter by `tenantId` from the principal, not from a free-form client field.

**Async commands and domain events over Kafka.** Upload produces a **command** on `video.processing` — “process” or “cancel.” When media reaches a terminal outcome, the worker produces a **media event** on a second topic — ready or failed — and a second consumer turns that into staff notifications. That’s not full CQRS with separate read models; it’s the useful half: write path stays on Postgres, async work is commanded, side effects react to events. One consumer group per responsibility so processing and notifications don’t share offset progress.

**Polling as a completion pattern.** MediaConvert doesn’t push into our VPC in v1, so a poller periodically `GetJob`s for rows in `processing`. That’s an explicit tradeoff versus SNS/EventBridge: simpler ops early, more load and latency later. In interview language: polling is the pattern; event-driven completion is the documented evolution.

**Finite state machine — media status.** `queued` → `processing` → `ready` | `failed`. Transitions are owned by upload, worker, and poller. Cancel doesn’t invent a fifth status: it asks AWS to stop and lets the poller land on `failed`, so one path owns the terminal write and the outbound event. Publish state is a second axis (`draft` / `published`), not mixed into media status.

**Idempotent consumers.** Kafka can redeliver. Before submitting MediaConvert we skip if status is already `ready`, or already `processing` with a job id. That keeps “at least once” delivery from double-encoding.

**Shared kernel.** `@academistream/db` owns Drizzle schema and types. API and worker agree on columns like `media_status` and `playback_key` without duplicating migrations. That’s a deliberate shared-kernel choice inside the modular monolith.

**Fail-closed multi-tenancy.** Not a GoF name, but a security pattern: every tenant query scopes by membership tenant; cross-tenant ids look like not found. Quotas and audit hang off the same convention.

### Classic / GoF-style patterns (same codebase)

If they ask specifically for textbook design patterns, I map the same places to GoF names so it doesn’t sound like we only know “architecture buzzwords.”

**Adapter** is the clearest one: `StorageService` is the target interface; `LocalStorageService` and `S3StorageService` adapt disk and AWS to that contract. Mail and playback URL follow the same idea.

**Strategy** is processing mode: local stub versus MediaConvert, chosen once from config, then `handle` runs the selected behavior without the rest of the worker caring which AWS SDK calls exist.

**Factory** is `createStorageService` and Nest `useFactory` providers — given config, return the right concrete object. We don’t new up S3 inside the videos controller.

**Command** is the Kafka processing message: an explicit request to process or cancel a video, handled later by the worker. The media lifecycle message is closer to an event than a command — outcome already happened.

**Chain of Responsibility** is the global guard order: JWT first, then roles. Each step can allow, deny, or skip via `@Public`; the controller never reimplements that chain.

**Singleton** is Nest’s default provider scope: one poller, one Kafka producer, one storage instance per process — intentional shared clients, not accidental globals.

Looser but honest fits: **Observer / pub-sub** for “media ready/failed → notifications consumer”; **State** in spirit via `media_status` transitions without a class hierarchy of state objects; **Builder** in spirit via `buildMediaConvertJobSettings` assembling a bulky AWS job config; **Facade** in spirit via `VideosService` orchestrating DB, storage, and Kafka for upload/retry/cancel/delete.

What I *don’t* claim: a full **Repository** layer — services use Drizzle directly; Nest’s `@Public` / `@Roles` are metadata decorators, not the GoF **Decorator** pattern wrapping objects; we didn’t force Template Method or Proxy hierarchies where a function and an interface were enough.

Closing line for this part: we use Adapter, Strategy, and Factory at the I/O boundary; Command and pub-sub on Kafka; Chain of Responsibility on the request pipeline — without turning the codebase into a pattern museum.

If they push “which pattern mattered most?”: **adapters for storage**, **async command/event split for media**, and **guards plus tenant-scoped queries for isolation**. Everything else supports those three.

---

## 3. Domain and data model

I’ll walk the domain the way a customer uses the product, then map it to tables.

A **tenant** is the customer org — name, status active or suspended, and optional caps on max users and max videos. Null caps mean unlimited. Platform staff create tenants; they are not “members” of a tenant in the same way.

A **user** is a global identity — email, password hash, name, and a flag `is_platform_admin`. The same person could in theory belong to more than one tenant later; today the API generally takes the first membership on the JWT for tenant context.

**Tenant memberships** glue user to tenant with a role: `tenant_admin`, `instructor`, or `learner`. Unique on user plus tenant. That’s the core of RBAC for tenant-scoped routes. Platform admin is a separate bit on the user, not a membership row.

**Courses** belong to a tenant. **Videos** belong to a course and a tenant. A video has title, optional `storage_key` and `playback_key`, MediaConvert job id while encoding, publish state draft or published, and media status queued, processing, ready, or failed — plus an optional failure reason. Publish and media are independent: you can have a ready draft that learners still can’t play.

**Assignments** target a **video**, not a course — we assign a specific piece of content to a learner. Progress and completions hang off that. Learners report watch percent; at a threshold we record completion and can notify staff.

Around that we have **invites** for onboarding, **notifications** for in-app inbox, **audit events** for sensitive actions, and **quotas** enforced when inviting or creating videos. I’m happy to go deep on any of those; for architecture the important idea is they all inherit the same tenant-from-JWT convention.

**Isolation, spoken clearly:** every tenant-scoped query uses `tenantId` from the authenticated principal — from JWT memberships — not a client-supplied tenant id alone. If Globex asks for Acme’s video id, we return not found for that tenant, not a leaky “forbidden but it exists.” Cross-tenant access should fail closed. Platform admin routes are global — create tenant, patch quotas — and don’t use `GET /tenants/me` the same way a member would.

**Media status machine, quickly:** create video row → upload sets storage key and queued → worker processing → ready with playback key, or failed with reason. Retry can re-queue a failed video without re-uploading if the object is still there. Cancel asks MediaConvert to stop; we leave the row processing until the poller sees canceled and marks failed, so one path owns the terminal state and the media event. Delete refuses while processing, and removes storage objects for source and output when present.

That’s the domain I’d defend in a design interview: tenancy and memberships as the security boundary, content and training as the product, media status as the async lifecycle, everything else as supporting modules on the same conventions.

---

## Close this block (before auth / video deep dives)

So far: what the product is, how the boxes connect, which patterns we used where, and how the data model supports multi-tenant private training. Next I’d go into **auth and RBAC** — tokens, guards, refresh — then the **video pipeline** end to end, unless you want to interrupt on environments, Kafka, or isolation first.

---

## Cheat sheet (don’t read aloud)

| Box | Role |
|-----|------|
| Web | SPA, JWT in memory, refresh cookie |
| API | Sync HTTP, upload, enqueue, playback URL, RBAC |
| Worker | Kafka consumers, MediaConvert, poller, media-events → notify |
| Postgres | Shared truth (Drizzle) |
| Kafka | `video.processing` commands; `video.events` (media lifecycle) |
| S3 + MediaConvert | Private media; async transcode |
| Terraform | Bucket + MediaConvert role (per env) |

| Pattern | Where |
|---------|--------|
| Modular monolith + monorepo | Nest modules; `apps/*` + `packages/db` |
| Ports / adapters | `StorageService` → local/S3; `MAIL`; playback S3/CloudFront |
| Strategy | `resolveProcessingMode` → local vs MediaConvert |
| DI + factory | `STORAGE` token, `StorageModule` `useFactory` |
| Guard pipeline | global `JwtAuthGuard` → `RolesGuard`; `@Public` / `@Roles` |
| Commands + events | Kafka process/cancel vs media ready/failed |
| Polling | MediaConvert completion poller |
| State machine | `media_status`; publish separate |
| Idempotent consumer | skip if ready / job id already set |
| Shared kernel | `@academistream/db` schema |
| Fail-closed tenancy | JWT tenant + scoped queries |

| GoF / classic | Where (honest fit) |
|---------------|-------------------|
| Adapter | `StorageService` → local/S3; mail; playback |
| Strategy | processing mode local vs MediaConvert |
| Factory | `createStorageService` / Nest `useFactory` |
| Command | Kafka `process` / `cancel` jobs |
| Chain of Responsibility | `JwtAuthGuard` → `RolesGuard` |
| Singleton | default Nest provider scope (poller, producers) |
| Observer / pub-sub (loose) | media events → notify consumer |
| State (loose) | `media_status` transitions |
| Builder (loose) | `buildMediaConvertJobSettings` |
| Facade (loose) | `VideosService` orchestration |
| Not claimed | Repository layer; GoF Decorator; Template Method / Proxy museum |
