# Academistream

B2B private training-video platform. Each customer company is a **tenant** with its own users, courses, and videos. Staff upload and assign training; learners watch and report progress.

## See it in action

- [Instructor](docs/demo-screenshots/README.md#instructor-flow) — upload, publish, assign training
- [Learner](docs/demo-screenshots/README.md#learner-flow) — watch assigned videos and track progress

More detail and screenshots: [docs/demo-screenshots](docs/demo-screenshots/README.md)

## Try the hosted demo

Open **[academistream.online/?wake=true](https://academistream.online/?wake=true)**.

The first visit after idle can take about 1–2 minutes to start. Use that full link (with `wake=true`); the bare domain alone will not wake the demo.

**Sign in** with password `Password123!`:

- Admin — `admin@acme.local`
- Instructor — `instructor@acme.local`
- Learner — `learner@acme.local`

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

- Product tour (screenshots): [docs/demo-screenshots](docs/demo-screenshots/README.md)
- Full technical story: [docs/TECHNICAL.md](docs/TECHNICAL.md)
