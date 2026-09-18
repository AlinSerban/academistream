# Academistream

B2B private training-video platform. Each customer company is a **tenant** with its own users, courses, and videos. Staff upload and assign training; learners watch and report progress.

## Screenshots

<!-- Add demo screenshots here (e.g. docs/demo-screenshots/). -->

## Try the hosted demo

**URL:** https://academistream.online/?wake=true  

Use the full wake link. The bare domain will not start a stopped VM (keeps crawlers from burning EC2 time).

| | |
|--|--|
| Cold start | ~1–2 minutes on first wake |
| Auto-stop | Stops after ~20 minutes with no page visits |
| Media | Local disk on the instance (no MediaConvert) — keeps demo cost low |

**Logins** (seed only — not production). Password: `Password123!`

- Admin: `admin@acme.local`
- Instructor: `instructor@acme.local`
- Learner: `learner@acme.local`

## Repo map

| Path | What |
|------|------|
| `apps/api` | NestJS HTTP API |
| `apps/web` | React (Vite) UI |
| `apps/worker` | Kafka consumer + media processing |
| `packages/db` | Shared Drizzle schema / DB client |
| `packages/shared` | Shared helpers (storage root, local mailer) |
| `infra/terraform` | AWS resources (S3, MediaConvert, …) |
| `infra/wake-worker` | Cloudflare Worker: wake / idle stop / proxy |

## Docs

Full technical story (architecture, how it works, local run, media modes, scale plan):

→ **[docs/TECHNICAL.md](docs/TECHNICAL.md)**
