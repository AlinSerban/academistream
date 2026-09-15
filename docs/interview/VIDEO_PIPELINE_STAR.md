# Video pipeline — interview prep

Academistream: multi-tenant B2B private training / streaming SaaS. Use this for system-design walkthroughs and behavioral (STAR) answers on the media path.

---

## Presenting the pipeline (functional + light technical)

**Context (30s):** We sell training to companies (tenants). Each org uploads private videos; learners watch assigned, published content. Media stays in a private bucket — playback uses short-lived signed URLs.

| Step | Functional | Technical (one line) |
|------|------------|----------------------|
| 1. Upload | Instructor uploads; UI shows `queued` → `processing` → `ready` / `failed` | `POST /videos/:id/upload` → storage adapter (`S3 PutObject` or local); key `tenants/{tenantId}/videos/{id}/source.mp4` |
| 2. Enqueue | Upload feels fast; transcode is background | Kafka `video.processing` payload: `{ videoId, tenantId, storageKey }` after DB `queued` |
| 3. Worker | Status moves to `processing` | NestJS worker, Kafka consumer, same Postgres (Drizzle); idempotent if job id already set |
| 4. Transcode | Output MP4 in tenant prefix on S3 | MediaConvert `CreateJob`; IAM role (Terraform) for S3 read/write; `mediaconvert_job_id` on row |
| 5. Complete | `ready` or `failed` after poll interval | Poller `GetJob` every ~15s; sets `playback_key` or `failed` + staff notification; SNS later |
| 6. Playback | Play on library (staff); API for learners | `GET /videos/:id/playback` — RBAC, published check for learners, S3 presigned or CloudFront signed |
| 7. Security | Tenants isolated; no public objects | JWT `roles[].tenantId`; RolesGuard; bucket public access block |

**Close:** API = auth + upload + enqueue; worker = transcode; storage = adapter; completion = poll today, events tomorrow.

### Walkthrough (spoken)

We sell private training video to companies, so each customer is a tenant and files must never be world-readable. When an instructor uploads from the library, they pick a course and a file; the UI tracks `queued`, then `processing`, then `ready` or `failed`. The API accepts the upload on `POST /videos/:id/upload`, writes bytes through a storage adapter to either local disk or S3 `PutObject`, and always uses a tenant-scoped key like `tenants/{tenantId}/videos/{id}/source.mp4`. The important product choice is that we do not transcode inside that HTTP request: once the file is stored we set `mediaStatus` to queued and publish a Kafka message on `video.processing` with the video id, tenant id, and storage key, so the instructor gets a quick response while work continues in the background.

A separate NestJS worker consumes that topic from the same Postgres database the API uses. It marks the row processing, then either submits an AWS MediaConvert job when `STORAGE_PROVIDER` is S3 or runs a local stub that checks the file exists on disk. On AWS, MediaConvert reads the source from the private bucket using a dedicated IAM role we provision in Terraform, writes transcoded output under an `output/` prefix, and we store the MediaConvert job id on the video row. If Kafka redelivers the message, we skip duplicate work when a job id is already present.

MediaConvert finishes asynchronously, so a poller in the worker calls `GetJob` about every fifteen seconds for rows stuck in processing. When the job completes we parse the output path into `playback_key` and set `ready`; on error we set `failed` and notify tenant staff. That polling approach is our v1 completion path; SNS or EventBridge is the documented scale-up when volume or latency matters.

Playback is never a permanent public URL. Staff call `GET /videos/:id/playback` from the library; learners can use the same endpoint but only for published, ready videos. The API checks RBAC and publish state, then returns a short-lived S3 presigned URL or a CloudFront signed URL if CDN is configured. Security runs through the whole path: tenant id comes from the JWT, routes are guarded by role, and the bucket stays private with public access blocked.

In one sentence for interviews: the API handles auth, upload, and enqueue; the worker handles transcode; storage is an adapter; completion is poll today and events tomorrow.

---

## STAR stories

### 1. Issue in production — sessions breaking after ~60 seconds

**Situation:** After login, the library worked briefly, then every protected request failed; uploads and video list returned errors. Users had to re-login constantly.

**Task:** Restore stable sessions and unblock AWS media E2E testing.

**Action:** I separated web proxy noise from the real API failures and found repeated 500s in `RolesGuard`. That pointed to auth, not media. I traced the JWT lifecycle: the access token expires in 60 seconds and the web client auto-refreshes on 401. Login put the full payload in the token, but `refresh()` only copied `sub` and `username` into the new access token, so `roles` was missing after the first refresh and `user.roles.some()` crashed the guard. I updated refresh to include `roles` and `isPlatformAdmin` like login does, and changed the guard to return 403 when claims are missing instead of throwing. After that I re-ran the media E2E and hit a separate MediaConvert failure (story #3).

**Result:** Sessions stayed stable past refresh and protected routes worked reliably. We added unit tests on refresh and RolesGuard. The lesson: refresh must mirror login claims, and guards should fail closed without crashing the app.

---

### 2. Challenging feature — end-to-end async video pipeline

**Situation:** The product needed private video upload → transcode → playback for multi-tenant customers, with real AWS (S3 + MediaConvert) while dev and CI stay fast on local storage.

**Task:** Ship the media sprint: storage adapter, Kafka, worker, MediaConvert, signed playback, Terraform baseline, and tests.

**Action:** I started with Terraform for a private S3 bucket and a least-privilege MediaConvert IAM role, then built a storage adapter on the API so the same code path runs on local disk or S3 via `STORAGE_PROVIDER`. Upload writes the file, sets `mediaStatus` to queued, and produces a Kafka message so the HTTP request never waits on transcoding. A separate NestJS worker consumes the topic, marks the row processing, and either submits MediaConvert on AWS or runs a local stub that checks the file and sets ready. For completion I shipped a poller that calls `GetJob` every 15 seconds (SNS documented as the scale path), parses the output key into `playback_key`, and signs playback URLs via S3 presigned GET with an optional CloudFront path. Duplicate Kafka delivery is handled by skipping work when a MediaConvert job id is already stored, and every object key is tenant-scoped.

**Result:** We could demo upload → ready → inline play on real AWS with audio working. The design has a clear path to SNS and DLQ without over-building v1.

---

### 3. Debugging — upload showed processing then failed

**Situation:** Auth was fixed; upload reached `processing`, then the UI showed `failed` within about ten seconds. Worker logs mentioned Kafka, which made it easy to blame the wrong layer.

**Task:** Find the root cause without guessing between S3, Kafka, MediaConvert, or IAM.

**Action:** I read the API, worker, and web terminals in order and built a timeline: upload succeeded, Kafka delivered the job, the worker submitted MediaConvert, and the poller reported ERROR within seconds — so the failure was in AWS job execution, not enqueue. I confirmed the source file existed in S3 with `head-object` (~298KB), then ran `aws mediaconvert get-job` and got ErrorCode 1040: invalid audio selector. The job template set audio output but never defined matching input `AudioSelectors`, so MediaConvert rejected the job immediately. I wired explicit selectors on the input and `AudioSourceName` on the output, retested with a new upload, and added logging of `ErrorMessage` in the poller so the next failure would show up in worker logs without the CLI.

**Result:** The second upload reached ready and played in the browser. Future media failures are faster to diagnose.

---

### 4. Technical tradeoff — polling vs events for MediaConvert completion

**Situation:** MediaConvert finishes asynchronously; we needed the database to show `ready` or `failed` without holding the upload HTTP request or blocking the Kafka consumer for minutes.

**Task:** Pick a completion mechanism we could ship and operate on the current stack.

**Action:** I compared three options: polling `GetJob` from the worker, pushing completion through SNS into Lambda or the worker, or waiting synchronously inside the consumer (which would tie up the consumer and hurt throughput). For v1 I chose polling every 15 seconds in the same worker process that already runs the Kafka consumer, because it needed no new AWS wiring, worked in local dev, and matched our prototype ops budget. I made updates idempotent by only transitioning rows still in `processing`, and documented SNS/EventBridge in SCALE_PATH as the replacement when job volume, latency, or `GetJob` cost becomes a concern.

**Result:** We shipped in the sprint and E2E works on real AWS. I can explain exactly when and why we would move to event-driven completion.

---

### 5. Scope / delivery — shipping media for the product without blocking the rest of the roadmap

**Situation:** Academistream is a real B2B SaaS product (multi-tenant training, assignments, quotas, audit). Customers expect private video upload and playback, but the team also had auth, org, training, and notifications on the roadmap — we could not pause everything for a full streaming platform build.

**Task:** Deliver a production-shaped media path on real S3 and MediaConvert while local dev and CI stay on disk stubs and the team keeps velocity on other domains.

**Action:** I scoped v1 to one happy path: MP4 in, single MP4 out, tenant-scoped keys — no live streaming or multi-bitrate HLS yet. The storage adapter lets engineers and CI use local disk while customers use S3 on the same API surface. Kafka runs in Docker on dev instead of MSK, keeping the same topic contract with less ops until traffic justifies managed brokers. Completion uses a poller instead of SNS/Lambda in v1, with the next step written down. Terraform only provisions shared durable infra (bucket + MediaConvert role); CloudFront stays manual until CDN playback is prioritized. I also tightened definition of done for async work: merged code plus one real file through upload, transcode, and browser playback — which is what caught the auth refresh gap and the MediaConvert job template bug after merge.

**Result:** Media works on AWS for demos and early tenants without blocking MSK, ECS, or EventBridge work. The product can sell private upload, transcode, and signed playback; engineering has a written path to SNS, CloudFront in Terraform, and richer outputs when customers ask for them.

---

### 6. Adversity — stacked failures during first real AWS E2E

**Situation:** First full AWS test after Terraform and Docker — S3, Kafka, MediaConvert, signed playback — with API, worker, and web running locally. The sprint was complete in code; I needed a working demo on my laptop, solo, with no one to split debugging.

**Task:** Get upload → ready → play in the browser.

**Action:** The first blocker appeared about a minute after login: every protected route failed because JWT refresh dropped `roles` from the access token, so I fixed auth and RolesGuard before touching media again. The second blocker looked like Kafka or AWS: upload went to processing then failed in seconds, and worker logs mentioned Kafka. I refused to guess and walked the timeline from API through S3, Kafka, worker submit, and `get-job`, which showed MediaConvert error 1040 on the job template. Along the way I lost early terminal output when tabs refreshed, saw web proxy errors during API restarts, and had to re-login and use new video ids after each fix. I kept following the failure forward in time instead of restarting at the layer that merely appeared in the latest log line.

**Result:** The full path works with play and audio. I added MediaConvert error logging and a clearer E2E checklist from that session.

---

### 7. Project didn’t go according to plan — “shipped” sprint vs real E2E

**Situation:** Sprint 6 was complete in code — S3, Kafka, worker, MediaConvert, poller, playback, Terraform. The plan was terraform apply, copy `.env`, start three apps, instructor upload, wait, play — one validation afternoon — then auth isolation E2E and interview prep.

**Task:** Treat manual AWS E2E as the gate for “media is really done.”

**Action:** E2E failed immediately on auth, not AWS: refresh tokens still had roles from login, but new access tokens after refresh did not, and the library’s 2-second polling made that show up within a minute — a gap our media unit tests never exercised. After fixing refresh, upload reached processing then failed in seconds; mocked AWS tests had not caught the MediaConvert audio selector misconfiguration. What I planned as one afternoon became auth fix, retest, AWS CLI diagnosis, job settings fix, better logging, and retest. I re-scoped “done” so merge alone is not enough: we need S3 object present, Kafka consumed, `get-job` on failure, and playback in the browser on real AWS.

**Result:** The pipeline demo works on real AWS and we have a stronger definition of done for async features, plus concrete failure stories (refresh claims, MediaConvert 1040) for interviews.

---

## Question → story map

| Interview question | Story |
|--------------------|--------|
| Production incident / outage | #1 JWT refresh |
| Hard / complex feature | #2 Pipeline |
| Debugging / root cause | #3 MediaConvert 1040 |
| Tradeoff / architecture | #4 Poll vs SNS |
| Scope / prioritization / MVP on real product | #5 Ship media without blocking roadmap |
| Adversity | #6 Stacked E2E failures |
| Didn’t go according to plan | #7 Shipped vs E2E reality |

## One-liners

- **Why Kafka?** Decouple upload from transcode; retry consumer; fan-out later.
- **Why separate worker?** Scale, failure domain, long-running jobs off API.
- **Why presigned URLs?** Private bucket; no permanent public links.
- **Auth bug:** Refresh had roles; new access token didn’t.
- **Media bug:** MediaConvert job template, not infra.
