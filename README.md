# Academistream

B2B private training-video platform. Customer companies get their own org, users, and private videos.

**Backlog:** [Trello — Academistream](https://trello.com/b/NjB5lBuC/academistream)

## Apps

| Path | Package | Role |
|------|---------|------|
| `apps/api` | `@academistream/api` | NestJS HTTP API |
| `apps/worker` | `@academistream/worker` | Background / Kafka worker (no HTTP) |
| `apps/web` | `@academistream/web` | React (Vite) + TypeScript |

## Prerequisites

- Node.js 20+
- Docker Desktop (for Postgres, Redis, Kafka)

## Local setup

```bash
cp .env.example .env
docker compose up -d
npm install
```

Run apps (separate terminals):

```bash
npm run api:dev
npm run worker:dev
npm run web:dev
```

- API health: http://localhost:3000/health  
- Web: http://localhost:5173  

## Environments

Config targets: `local`, `uat`, `prod` (see `.env.example`). Prototype hosting: EC2 + Docker for app + Postgres/Kafka/Redis. Scale path: see `docs/engineering/SCALE_PATH.md`.
