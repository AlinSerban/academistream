# Academistream

B2B private training-video platform. Each customer company is a **tenant** with its own users, courses, and videos. Staff upload and assign training; learners watch and report progress.

## See it in action

- **[Instructor flow](docs/demo-screenshots/README.md#instructor-flow)**: upload, publish, assign training
- **[Learner flow](docs/demo-screenshots/README.md#learner-flow)**: watch assigned videos and track progress

Full gallery: **[docs/demo-screenshots](docs/demo-screenshots/README.md)**

## Try the hosted demo

Open **[academistream.online/?wake=true](https://academistream.online/?wake=true)**.

First visit after the demo has been idle can take about 1-2 minutes. You need the `?wake=true` part; opening https://academistream.online alone will not start it.

**Sign in** with password `Password123!`:

- Admin: `admin@acme.local`
- Instructor: `instructor@acme.local`
- Learner: `learner@acme.local`

## Documentation

What you will find in the technical docs, in short:

| Topic | Covers |
|-------|--------|
| Goal | Multi-tenant training product: roles, library, assignments, org tools |
| Architecture | Web, API, worker, Postgres, Kafka, Redis, storage, wake proxy |
| Monorepo | Apps, shared packages, Terraform, wake Worker |
| Tenancy and auth | JWT claims, memberships, roles, rate limits |
| Product flows | Upload → process → publish → assign → watch; quotas and audit |
| Media modes | Local disk (hosted demo) vs S3 + MediaConvert |
| Hosted demo | Wake link, idle stop, why media stays local |
| Local development | Docker, migrate, seed, run API / worker / web |
| Scale path | EC2 Compose today; ECS, RDS, and managed messaging later |
| Environments | `local` / `uat` / `prod` config notes |

Screenshots and click-through: **[Product tour](docs/demo-screenshots/README.md)**

Full write-up: **[Technical documentation](docs/TECHNICAL.md)**
