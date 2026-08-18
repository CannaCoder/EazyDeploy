# Architecture — Shipora

This document provides a deep-dive into Shipora's technical architecture, data flows, and key design decisions.

---

## System Overview

Shipora is a **multi-app monorepo** built on Turborepo with three runtime applications:

| App | Role |
|---|---|
| `apps/web` | Next.js 15 frontend — dashboard, landing page, real-time deploy logs |
| `apps/api` | Fastify backend — tRPC API, GitHub webhook handler, BullMQ dispatcher |
| `apps/temporal-worker` | Temporal worker — executes all workflow activities (deploy, conflict guard) |

These apps share code via internal packages:

| Package | Purpose |
|---|---|
| `packages/db` | Drizzle ORM schema + Neon Postgres client |
| `packages/temporal-workflows` | Workflow & activity type definitions (shared between api and worker) |
| `packages/github-app` | Octokit GitHub App client + webhook parsing |
| `packages/code-analyzer` | Tree-sitter static analysis engine |
| `packages/ui` | Shared React component library (shadcn/ui) |
| `packages/types` | Shared Zod schemas and TypeScript types |
| `packages/config-typescript` | Base tsconfig configurations |

---

## Data Flow: Push to Deploy

```
Developer pushes to main
        │
        ▼
GitHub sends webhook → apps/api /webhooks/github
        │
        ▼
api validates webhook signature (GITHUB_APP_WEBHOOK_SECRET)
api persists event to DB (audit_logs)
        │
        ▼
api dispatches → Temporal Cloud: ConflictGuardWorkflow
        │
        ▼
┌────────────────────────────────────────┐
│       ConflictGuardWorkflow        │
│                                    │
│  1. analyzeRepo                    │
│  2. scanMergeConflicts             │
│  3. scanLockfileHealth             │
│  4. validateEnvVars                │  ← checks user's uploaded .env
│  5. reportGitHubStatus             │  ← no provisioning, just report
└──────────────┬─────────────────────────┘
               │
      ┌─────────┬─────────┐
      │                 │
   PASS               FAIL
      │                 │
      ▼                 ▼
  (User clicks      GitHub Commit
   Deploy)          Status = ❌
      │             Shipora dashboard
      ▼             shows failure report
Temporal: DeployWorkflow
      │
      ├─► analyzeRepo
      │       └─► Detect services + build commands
      │
      ├─► buildContainer (per service, parallel)
      │       └─► AWS CodeBuild → Docker image → ECR
      │
      ├─► provisionECS (per service)
      │       └─► AWS ECS Fargate task + service
      │
      ├─► injectSecrets
      │       └─► User's .env from AWS Secrets Manager → ECS task env
      │             (valueFrom references — never plaintext)
      │
      ├─► verifyDeployment
      │       └─► HTTP health checks on all services
      │
      └─► (if fail) rollback
              └─► Restore previous ECS task definitions
```

---

## Database Schema

```sql
-- Users (synced from Clerk)
users (
  id          uuid PRIMARY KEY,
  clerk_id    text UNIQUE NOT NULL,
  github_id   bigint UNIQUE,
  email       text NOT NULL,
  name        text,
  avatar_url  text,
  created_at  timestamptz DEFAULT now()
)

-- Projects (linked GitHub repos)
projects (
  id                     uuid PRIMARY KEY,
  owner_id               uuid REFERENCES users(id),
  name                   text NOT NULL,
  github_repo_owner      text NOT NULL,
  github_repo_name       text NOT NULL,
  github_installation_id bigint NOT NULL,
  production_branch      text DEFAULT 'main',
  env_secret_arn         text,  -- AWS Secrets Manager ARN for user's .env
  created_at             timestamptz DEFAULT now()
)

-- Services (auto-detected from repo analysis)
services (
  id                 uuid PRIMARY KEY,
  project_id         uuid REFERENCES projects(id),
  name               text NOT NULL,       -- e.g. "frontend", "api"
  type               text NOT NULL,       -- nextjs | vite | node | fastapi | docker
  root_path          text NOT NULL,       -- path in repo, e.g. "apps/web"
  port               integer NOT NULL,
  build_command      text,                -- auto-detected, e.g. "npm run build"
  ecs_service_arn    text,
  current_task_def   text,
  previous_task_def  text,
  service_url        text,
  created_at         timestamptz DEFAULT now()
)

-- Deployments
deployments (
  id                   uuid PRIMARY KEY,
  project_id           uuid REFERENCES projects(id),
  commit_sha           text NOT NULL,
  branch               text NOT NULL,
  status               text NOT NULL,  -- pending | building | deploying | success | failed | rolled_back
  triggered_by         uuid REFERENCES users(id),
  temporal_workflow_id text,
  started_at           timestamptz,
  completed_at         timestamptz,
  created_at           timestamptz DEFAULT now()
)

-- Conflict Guard Checks
conflict_checks (
  id               uuid PRIMARY KEY,
  project_id       uuid REFERENCES projects(id),
  commit_sha       text NOT NULL,
  branch           text NOT NULL,
  status           text NOT NULL,      -- running | passed | failed
  merge_conflicts  boolean,
  lockfile_healthy boolean,
  env_vars_valid   boolean,            -- all vars in code found in user's .env
  failure_details  jsonb,
  created_at       timestamptz DEFAULT now()
)

-- Audit Logs
audit_logs (
  id          uuid PRIMARY KEY,
  project_id  uuid REFERENCES projects(id),
  actor_id    uuid REFERENCES users(id),
  event       text NOT NULL,
  metadata    jsonb,
  created_at  timestamptz DEFAULT now()
)
```

> **Note:** No `service_relations` table. Shipora does not manage inter-service wiring — users handle their own service URLs via their `.env` file. The `env_secret_arn` on `projects` points to AWS Secrets Manager where the user's full `.env` is stored encrypted.

---

## Key Design Decisions

### Why Temporal Cloud?
Shipora's deploy pipeline is inherently **long-running, stateful, and failure-prone**. A deploy can take 15–30 minutes and involves calls to GitHub, AWS CodeBuild, ECS, and multiple health check polls. Temporal provides:
- **Durability** — workflow state survives worker crashes
- **Retries** — per-activity retry policies with backoff
- **Visibility** — full execution history for debugging
- **Cancellation** — safe pipeline cancellation mid-flight
- **Compensation** — rollback triggered as a saga pattern on failure

### Why AWS ECS Fargate?
- Serverless containers — no EC2 management
- Per-service task definitions — full isolation between user services
- Native integration with CodeBuild, ECR, Secrets Manager, and ALB
- Scales to zero between deploys (no idle cost)

### Shipora Does NOT Provision User Infrastructure
Shipora is a **deployment tool, not an infrastructure provider**. Users bring their own database, Redis, and all third-party services. Shipora only:
- Deploys the user's code to AWS ECS
- Injects the user's own secrets from AWS Secrets Manager into ECS tasks
- Never generates, provisions, or manages any of the user's infrastructure

This keeps Shipora focused, fast, and non-intrusive.

### Secret Injection (User's .env)
Users upload their `.env` once. Shipora:
1. Stores it in **AWS Secrets Manager** (encrypted at rest, never plaintext)
2. On deploy, injects values as `valueFrom` references in the ECS task definition
3. Secrets never appear in ECS console, CloudWatch logs, or Shipora's database
4. User can update secrets from the Shipora dashboard — triggers a re-deploy

### Real-Time Log Streaming
Logs are streamed from the Temporal worker → API → browser using **Server-Sent Events (SSE)**:
```
temporal-worker
    │ publishes log lines to Upstash Redis channel
    ▼
apps/api SSE endpoint
    │ subscribes to Redis channel, streams to client
    ▼
apps/web EventSource
    │ renders log lines in real-time per service
```

### Zero-Downtime Deploys
- New ECS task definition registered but NOT yet serving traffic
- Health Monitor polls the new tasks directly (by task IP) for up to 5 min
- Only once ALL services pass: ECS service updated to use new task definition
- ALB routes traffic to new tasks; old tasks deregistered and stopped
- If health check fails at any point: Rollback Agent restores previous task definition

---

## Infrastructure (AWS CDK)

```
infra/aws-cdk/
├── lib/
│   ├── vpc-stack.ts          # VPC, subnets, security groups
│   ├── ecs-cluster-stack.ts  # ECS cluster + ALB
│   ├── ecr-stack.ts          # ECR repos per service
│   ├── codebuild-stack.ts    # CodeBuild project for Docker builds
│   └── secrets-stack.ts      # IAM roles + Secrets Manager policies
└── bin/
    └── shipora.ts            # CDK app entrypoint
```

---

## Security

- **Secrets**: Never stored in plaintext. All user secrets stored in AWS Secrets Manager. Injected into ECS tasks as `valueFrom` references — never appear in ECS console or CloudWatch logs.
- **GitHub Webhooks**: All incoming webhooks validated using `GITHUB_APP_WEBHOOK_SECRET` via HMAC-SHA256.
- **Auth**: All API routes protected by Clerk JWT verification middleware. tRPC context includes authenticated user on every request.
- **Network**: ECS tasks run in private subnets. Only the ALB is internet-facing. Task-to-task communication is via private IPs within the VPC.
