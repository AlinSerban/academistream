# Auth & RBAC — interview prep

Academistream: multi-tenant B2B private training / streaming SaaS. Use this for system-design walkthroughs and behavioral (STAR) answers on identity, roles, and tenant isolation.

---

## Presenting auth & RBAC (functional + light technical)

**Context (30s):** B2B SaaS: each customer is a **tenant**. Users have **roles** inside a tenant (`tenant_admin`, `instructor`, `learner`). Our **platform team** provisions tenants (`platform_admin`). Learners only see assigned, published content — not the whole library.

| Step | Functional | Technical (one line) |
|------|------------|----------------------|
| 1. Login | User signs in on web; stays logged in across refresh | `POST /auth/login` — bcrypt verify, load `tenant_memberships`, issue JWT |
| 2. Tokens | Short sessions; password not in long-lived client storage | Access JWT in Redux memory (~60s); refresh JWT in HttpOnly cookie (7d, `sameSite: strict`) |
| 3. Every API call | Protected routes need a valid user | Global `JwtAuthGuard` (Passport JWT); `@Public()` for login, refresh, logout, invite accept |
| 4. Role check | Instructor can upload; learner cannot | Global `RolesGuard` + `@Roles(...)` per controller or handler |
| 5. Tenant scope | Acme never sees Globex data | `tenantId` from `user.roles[].tenantId` in JWT — not client-supplied tenant id alone |
| 6. Platform vs tenant | Platform admin creates tenants / quotas | `isPlatformAdmin` + `@Roles('platform_admin')`; no tenant membership required |
| 7. Silent refresh | App keeps working after access expires | RTK Query: 401 → `POST /auth/refresh` → retry with new access token |
| 8. Defense in depth | Role alone is not enough | Service layer: learner + draft → 403; progress only if assigned; cross-tenant → 404 |

**JWT payload:** `sub`, `username`, `isPlatformAdmin`, `roles: [{ tenantId, role }]`.

**Close:** Authentication (who) + authorization (what they can do) + tenancy (which org’s data). v1 puts roles in the JWT for speed; `GET /auth/me` reloads memberships from the database when you need fresh state.

### Walkthrough (spoken)

Academistream is B2B: each paying company is a tenant, and users inside that tenant get a role — tenant admin, instructor, or learner. Our own platform team can provision tenants as platform admins. Learners are not meant to browse the full video library; they interact with assigned, published training. That business model drives how we built auth.

When someone signs in on the web app, `POST /auth/login` verifies the password with bcrypt, loads their rows from `tenant_memberships`, and issues tokens. We use two tokens on purpose: a short-lived access JWT kept in Redux memory, and a longer refresh JWT in an HttpOnly cookie with strict same-site settings so a stolen access token has limited life and the refresh token is harder for script-based attacks to read. The access JWT carries `sub`, `username`, `isPlatformAdmin`, and `roles` as an array of `{ tenantId, role }` pairs.

Every protected API route goes through two global guards before the handler runs. `JwtAuthGuard` validates the bearer token unless the route is marked `@Public()` for login, refresh, logout, or public invite acceptance. Then `RolesGuard` reads `@Roles(...)` on the controller or method — for example instructors and admins on content upload, learners allowed only on playback and progress endpoints. Platform-only operations like creating a tenant use `@Roles('platform_admin')` together with the `isPlatformAdmin` flag, and those users may have no tenant membership at all.

Tenant isolation is a convention we enforce everywhere: controllers take `tenantId` from the JWT membership, not from an untrusted body field, and services scope queries with that id. If Globex asks for an Acme video id, we return 404 as if the row does not exist for them, rather than 403 that might confirm a cross-tenant id. Platform admins operate globally; tenant users never cross org boundaries through the API.

On the web, RTK Query wraps the HTTP client so that when a call returns 401, the client posts to `/auth/refresh` with the cookie, swaps in a new access token, and retries once. That is how the library can poll every two seconds without forcing re-login every minute. Roles in the JWT make guards fast in v1; when we need fresher membership data we use `GET /auth/me` or can later reload from the database on refresh.

Authorization does not end at the guard. Services apply business rules on top of role: a learner with a valid token still cannot play a draft video, and progress updates require an assignment. So the story is three layers — authenticate the user, check role on the route, then enforce tenant and business rules in the service.

---

## STAR stories

### 1. Issue in production — sessions breaking after ~60 seconds

**Situation:** After login, tenant users could use the app briefly, then the library and uploads failed with 500s. Re-login fixed it until the next refresh cycle.

**Task:** Restore stable auth for all protected routes and unblock downstream E2E work.

**Action:** I noticed failures started about a minute after login, which matched our 60-second access token TTL and the web client’s silent refresh on 401. API logs showed `RolesGuard` throwing because `user.roles` was undefined, not a generic middleware failure. I compared `signIn()` and `refresh()` in `AuthService`: login embedded full memberships in the JWT, but refresh only copied `sub` and `username` into the new access token. I fixed refresh to preserve `roles` and `isPlatformAdmin` from the refresh token, hardened the guard to return 403 when claims are missing instead of crashing, and added unit tests so login and refresh stay in parity going forward.

**Result:** Sessions stayed stable after refresh and every protected route behaved consistently. The takeaway for the team: token refresh must carry the same authorization claims as login, and guards should fail closed without taking down the API.

---

### 2. Challenging feature — multi-tenant RBAC across API and web

**Situation:** Academistream needed real B2B isolation: multiple tenants, four role types, platform operators vs tenant users, and consistent rules across content, training, org, and quotas.

**Task:** Ship auth that new modules can plug into without reinventing security every sprint.

**Action:** I implemented two global NestJS guards: `JwtAuthGuard` validates the bearer token on every route except those marked `@Public()`, and `RolesGuard` reads `@Roles(...)` metadata to allow or deny the handler. Login loads memberships from `tenant_memberships`, puts them in the JWT together with `isPlatformAdmin`, and stores a longer-lived refresh token in an HttpOnly cookie while the access token lives only in Redux memory. Controllers never trust a client-supplied tenant id; they take `tenantId` from the JWT and pass it into services, which return 404 for cross-tenant resource access so we do not leak whether a row exists in another org. Platform routes use `@Roles('platform_admin')` and `isPlatformAdmin` for tenant provisioning and quota overrides. On the web, RTK Query’s `baseQueryWithReauth` retries once after refresh on 401. I added controller specs with Acme vs Globex JWT fixtures and a full matrix test for RolesGuard so CI catches regressions without a live database.

**Result:** Content, training, org, and notifications all share one auth model. New endpoints are mostly “add `@Roles` and scope by JWT tenantId.”

---

### 3. Debugging — “is it auth, tenant, or business rule?”

**Situation:** Users reported they could not access videos or the library errored — easy to blame media, AWS, or a specific feature when the failure was earlier in the stack.

**Task:** Classify failures quickly: unauthenticated vs wrong role vs wrong tenant vs business rule (draft video, not assigned).

**Action:** I used status codes as the first filter: 401 means the token path, 403 means role or business rule, 404 often means wrong tenant or missing row for that tenant. When someone said “it worked then stopped,” I looked at refresh rather than login. I walked the request order on failing routes: JWT validation, RolesGuard, then service checks like `publishState` for learners and `assertAssigned` for progress. For reproduction I used seed accounts (`admin@acme.local`, `learner@globex.local`) so isolation bugs were obvious. That discipline kept a later media E2E from chasing S3 when the first real blocker was still auth.

**Result:** Faster triage for the team and a documented isolation convention in the README (JWT tenantId, 403 vs 404).

---

### 4. Technical tradeoff — roles in JWT vs database lookup every request

**Situation:** Every API call needs tenant and role context; loading memberships from Postgres on each request is correct but adds latency and database load.

**Task:** Pick an authorization model for v1 that is correct and fast enough for a modular monolith.

**Action:** I put `roles[]` and `isPlatformAdmin` in the access JWT so `RolesGuard` and controllers do not query the database on every request. I accepted that role changes are not instant until re-login or a refresh that reloads memberships from the database — acceptable for training SaaS in v1. Short access TTL (60 seconds) limits how long stale claims live in memory; refresh is the natural place to reload from the database when we need faster revocation. I rejected per-request DB role lookup on every handler for v1 because it would multiply queries across a growing API surface, and deferred OPA/Casbin until rule complexity justifies an external policy engine.

**Result:** Guards stay simple and testable, with a clear upgrade path: refresh-from-DB or token revocation without redesigning routes.

---

### 5. Scope / delivery — security for the real product without blocking features

**Situation:** Academistream needed credible tenancy and RBAC early — demos and customers depend on “Acme cannot see Globex” — but we also had to ship content, training, org, and quotas in parallel.

**Task:** Deliver production-shaped auth without a six-month identity project.

**Action:** I limited v1 to four tenant roles plus a platform flag instead of per-customer permission matrices or ABAC. Tenant scoping became a team convention: `tenantId` from the JWT in every service query, documented in the README, with cross-tenant access returning 404. Security tests in Sprint 1 use Jest mocks and fake JWT payloads so CI stays fast without a transactional test database. Invites and memberships handle onboarding for sales-led B2B instead of public self-signup. I explicitly deferred Supertest e2e against real Postgres, multi-org switching in the UI, and fine-grained policies — v1 uses the first membership in the JWT for tenant context. That let auth ship early while content and training sprints continued on the same guard and decorator pattern.

**Result:** Credible B2B security story for demos and early tenants without blocking feature delivery. Backlog is clear: e2e auth tests, org switcher, refresh reloads memberships from DB.

---

### 6. Adversity — auth failure masked as “whole app broken”

**Situation:** During first AWS media E2E, nothing worked after a minute — uploads, lists, polling — while Docker, Kafka, and Terraform all looked healthy. I was debugging solo with no dedicated security teammate.

**Task:** Determine whether AWS, Kafka, or auth was the real blocker.

**Action:** The API terminal showed 500s in `RolesGuard`, not S3 or Kafka errors. The web client showed proxy errors when the API restarted, which was secondary noise. I fixed auth first — refresh was dropping `roles` from the access token — before spending more time on MediaConvert or bucket policies. Only after sessions were stable did upload reach processing and expose a separate MediaConvert template bug. Kafka messages in the worker logs had looked suspicious earlier, but the consumer was healthy; the app had been failing on every guarded route before any message mattered. I kept a timeline of what failed when instead of treating the latest log line as the root cause.

**Result:** Auth fix unlocked the rest of E2E. I internalized: when all protected routes fail together, check identity before infrastructure.

---

### 7. Project didn’t go according to plan — “auth was done” until integration

**Situation:** Sprint 1 shipped login, JWT, RolesGuard, and isolation unit tests. The plan assumed auth was stable while later sprints stacked content, training, and media on top.

**Task:** Keep velocity on new features without rediscovering auth gaps in production-like flows.

**Action:** Months later, a media E2E with library polling every two seconds exposed a refresh bug that login-only tests never triggered: access tokens expired in 60 seconds, refresh succeeded, but the new access token lacked `roles`, so RolesGuard crashed. Sprint 1 was “done” from a login and controller-spec perspective, but we had not required parity between login and refresh token payloads. I added a refresh unit test and guard tests for missing roles, and changed our definition of done for auth to include the full token lifecycle — login, silent refresh, and a protected route — not just happy-path sign-in.

**Result:** Stronger auth checklist for future sprints. The refresh gap was fixed before we treated media as production-ready.

---

## Question → story map

| Interview question | Story |
|--------------------|--------|
| Production incident / outage | #1 JWT refresh / RolesGuard |
| Hard / complex feature | #2 Multi-tenant RBAC |
| Debugging / root cause | #3 401 vs 403 vs 404 |
| Tradeoff / architecture | #4 JWT claims vs DB |
| Scope / prioritization (real product) | #5 Four roles + conventions |
| Adversity | #6 Auth masked as full outage |
| Didn’t go according to plan | #7 Sprint 1 “done” vs refresh gap |

## One-liners

- **Why two tokens?** Short access in memory; long refresh in HttpOnly cookie — limits XSS stealing a long-lived bearer.
- **Why roles in JWT?** Fast guards; refresh is the revocation and reload point.
- **403 vs 404?** No permission vs no row for that tenant — avoid cross-tenant enumeration.
- **Platform admin?** Global operator; provisions tenants; not a tenant member route.
- **Production bug:** Refresh dropped `roles`; guard crashed instead of 403.
