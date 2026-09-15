# Video pipeline — full flow (mental picture)

Companion to `VIDEO_PIPELINE_STAR.md`. Use this for code walkthroughs and “how does it run end-to-end?” — including **who listens**, **how often**, and **what changes in the DB**.

---

## Processes at runtime (local dev)

```
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  web :5173  │   │ api :3000   │   │ worker      │
│  (browser)  │   │ HTTP + JWT  │   │ no HTTP     │
└─────────────┘   └─────────────┘   └─────────────┘
                         │                  │
                         │                  ├── Kafka consumer (always listening)
                         │                  └── Poller timer (every 15s, S3 mode only)
                         │
                    Docker: Postgres, Kafka, Redis
                         │
                    AWS: S3 bucket + MediaConvert (on upload / transcode only)
```

---

## Phase 0 — Before upload (user-driven, ~instant)

**Who:** Instructor on Library (`/`), logged in.

**What:** UI `POST /videos/create` → DB **insert**: title, courseId, tenantId. Row exists with default `mediaStatus` (`queued` in schema) but **no file**, no `storageKey`, no `playbackKey`.

---

## Phase 1 — Upload & enqueue (~1–5s, one HTTP request)

**Trigger:** “Create & upload” on Library.

```
Browser ──multipart POST /videos/:id/upload──► API
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │  JWT + RolesGuard (instructor / tenant_admin)     │
                    │  getVideoById (tenant scope)                      │
                    │  storage.putObject → S3 or .data/media            │
                    │  DB UPDATE: storageKey, mediaStatus = queued      │
                    │  Kafka PRODUCE topic video.processing             │
                    │  HTTP 200 + updated video row                     │
                    └───────────────────────────────────────────────────┘
```

**UI:** `media: queued`. List polls every **2s** while any video is `queued` or `processing`.

**Kafka:** Message on topic until worker consumes (usually **&lt;1s**).

**AWS:** S3 object created; no MediaConvert yet.

---

## Phase 2 — Worker consumes & submits (~1–3s after message)

**Listener:** Worker **Kafka consumer** — connected at startup; `eachMessage` per message.

```
Kafka ──message──► consumer.eachMessage
                      │
                      ▼
              VideoProcessingService.handle
```

| Step in handle | DB `mediaStatus` | AWS |
|----------------|------------------|-----|
| Early exit if `ready` or duplicate (`processing` + `mediaConvertJobId`) | unchanged | — |
| `setStatus(processing)` | **processing** | — |
| `submitMediaConvertJob` (S3 mode) | still **processing** | **CreateJob** → job id |
| Store `mediaConvertJobId` | still **processing** | MediaConvert **runs** job |

**UI:** `processing` on next list poll (~2s).

**Transcode duration:** Seconds to minutes (file size). Not blocking HTTP or Kafka consumer after submit.

**Local mode (`STORAGE_PROVIDER=local`):** No MediaConvert — file exists on disk → **`ready`** + `playbackKey` in `handle`.

---

## Phase 3 — Completion polling (background, every **15s**)

**Listener:** `MediaConvertCompletionPoller` — `setInterval` on worker startup (**only** if `STORAGE_PROVIDER=s3`). Not Kafka.

```
Every 15s:
  SELECT videos WHERE mediaStatus = 'processing'
  FOR each row WITH mediaConvertJobId:
      GetJob(AWS)
        SUBMITTED / PROGRESSING → no DB change, wait next interval
        COMPLETE → playbackKey + mediaStatus = ready
        ERROR / CANCELED → mediaStatus = failed + staff notification
  (rows in processing WITHOUT mediaConvertJobId are skipped each cycle)
```

**UI:** Stays `processing` until poller sees COMPLETE (up to **~15s** after AWS finishes).

---

## Phase 4 — Ready in UI

**DB:** `mediaStatus = ready`, `playbackKey` = transcoded object key (e.g. `tenants/1/videos/6/output/source.mp4`).

**UI polling:** Stops 2s polling when nothing is `queued` / `processing`.

**S3:** Source + output objects in bucket.

---

## Phase 5 — Play (user click, ~1s HTTP)

**Trigger:** **Play** button on a `ready` video (not the `<video>` controls first).

```
Browser ──GET /videos/:id/playback + Bearer JWT──► API
                    │
                    │  JWT + RolesGuard (learner allowed on this route)
                    │  mediaStatus must be ready
                    │  learner → publishState must be published
                    │  PlaybackUrlService.getSignedGetUrl(playbackKey)
                    │     → S3 presigned URL (your setup)
                    │     → or CloudFront signed URL if CLOUDFRONT_* env set
                    │
Browser ◄── { url, expiresIn: 3600 } ──
                    │
                    ▼
         <video src={url} controls />
         Browser loads bytes from S3 (or CloudFront); user uses native controls
```

**Worker:** Not involved.

**URL TTL:** ~**1 hour** from **Play** click (not tied to JWT 60s access token).

**Page refresh:** State lost → user clicks **Play** again → **new** URL with fresh 1h TTL. Seek/fast-forward works while URL is valid. Library does **not** auto-resume watch position after refresh.

---

## Example timeline (AWS happy path)

```
0s      createVideo           DB row exists
+2s     upload completes      queued, S3 object, Kafka message
+3s     handle                processing + MediaConvert job id
+3–60s  MediaConvert runs     UI: processing (poll every 2s)
~45s    job COMPLETE          (example)
+45–60s poller sees COMPLETE  ready + playbackKey (poll every 15s)
        UI shows ready
user    clicks Play           GET playback → presigned URL
        <video> streams       from S3 for up to 1h per URL
```

---

## Who listens / loops

| Component | When it runs | Interval / trigger |
|-----------|--------------|-------------------|
| API Kafka producer | Each upload | Connected at API startup |
| Worker Kafka consumer | Always (worker up) | Each message on `video.processing` |
| MediaConvert poller | S3 mode only | **Every 15s** |
| Web video list poll | While queued or processing | **Every 2s** |
| MediaConvert (AWS) | After CreateJob | Until COMPLETE / ERROR |
| Playback | User clicks Play | One HTTP request per click |

---

## Status timeline (AWS)

```
createVideo     → row exists (no file)
upload          → queued
handle          → processing (+ mediaConvertJobId)
poller (wait)   → processing (SUBMITTED / PROGRESSING)
poller          → ready + playback_key   OR   failed
Play            → browser streams via presigned URL
```

---

## Playback URLs — S3 vs CloudFront (deployment OR, not per video)

`PlaybackUrlService` picks **one** path per deployment:

- **CloudFront env configured** → signed `https://dxxx.cloudfront.net/{key}?...`
- **Else (your setup)** → S3 presigned `https://bucket.s3.../{key}?X-Amz-Signature=...`

Same `playbackKey`; different front door. Bucket stays private.

**RBAC** happens at `GET /playback` (JWT, tenant, role, published). The signed URL itself is a **time-limited capability** — anyone with the link can use it until expiry (typically 1h); S3 does not re-check JWT.

**Long videos:** If watch time + buffering exceeds URL TTL, playback may stall; refresh page + Play again mints a new URL. v1 training clips are usually short enough that 1h is fine.

---

## One-liner (interview)

Instructor uploads → API writes private storage and enqueues Kafka → worker submits MediaConvert and a poller completes the row → instructor clicks Play → API checks RBAC and returns a short-lived signed URL → browser streams from S3 without a public bucket.
