# Deployment Guide — Shipora

This guide covers deploying the Shipora platform itself to production.

---

## Infrastructure Overview

Shipora runs on:
- **Vercel** — `apps/web` (Next.js frontend)
- **Fly.io or ECS** — `apps/api` (Fastify backend)
- **AWS ECS Fargate** — `apps/temporal-worker`
- **Temporal Cloud** — Workflow orchestration
- **Neon Postgres** — Platform database
- **Upstash Redis** — BullMQ queues + SSE pubsub

---

## Environment Setup

### Required Environment Variables

See [`.env.example`](../.env.example) for the full list.

Critical variables:
- `DATABASE_URL` — Neon Postgres connection string
- `CLERK_SECRET_KEY` — Clerk backend secret
- `GITHUB_APP_PRIVATE_KEY` — GitHub App private key (PEM format, newlines as `\n`)
- `TEMPORAL_ADDRESS` — Temporal Cloud namespace address
- `AWS_ECS_CLUSTER_ARN` — The ECS cluster where user apps are deployed

---

## Deploying apps/web (Next.js)

```bash
# Build
pnpm --filter web build

# Deploy to Vercel
vercel --prod
```

Environment variables must be configured in the Vercel dashboard or via `vercel env`.

---

## Deploying apps/api (Fastify)

```bash
# Build
pnpm --filter api build

# Build Docker image
docker build -f apps/api/Dockerfile -t shipora-api .

# Push to ECR and deploy to ECS (handled by GitHub Actions in CI)
```

---

## Deploying apps/temporal-worker

```bash
# Build
pnpm --filter temporal-worker build

# Build Docker image
docker build -f apps/temporal-worker/Dockerfile -t shipora-temporal-worker .

# Deploy to ECS (handled by GitHub Actions in CI)
```

---

## Running Migrations

```bash
# Generate migration files from schema changes
pnpm db:generate

# Apply migrations to production DB
pnpm db:migrate
```

> ⚠️ Always run migrations BEFORE deploying new app versions that depend on schema changes.

---

## AWS CDK Deployment

```bash
cd infra/aws-cdk

# Install CDK dependencies
pnpm install

# Deploy all stacks
npx cdk deploy --all

# Or deploy a specific stack
npx cdk deploy ShiporaEcsClusterStack
```

---

## CI/CD

All deployments are automated via GitHub Actions:

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | Every push / PR | Lint, type-check, build all packages |
| `deploy-web.yml` | Push to `main` | Deploy `apps/web` to Vercel |
| `deploy-api.yml` | Push to `main` | Build + push Docker image, update ECS service |
| `deploy-worker.yml` | Push to `main` | Build + push Docker image, update ECS service |
| `db-migrate.yml` | Push to `main` | Run Drizzle migrations |

---

## Health Checks

| Service | Health Endpoint |
|---|---|
| `apps/api` | `GET /health` |
| `apps/temporal-worker` | Temporal worker heartbeat |

---

## Monitoring

- **Logs**: CloudWatch Logs for ECS tasks, Axiom for structured API logs
- **Traces**: OpenTelemetry → Axiom
- **Temporal**: Temporal Cloud dashboard for workflow visibility
- **Uptime**: Configure an uptime monitor on `GET /health`
