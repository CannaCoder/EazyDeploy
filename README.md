<div align="center">
  <img src="docs/assets/shipora-banner.png" alt="Shipora Banner" width="100%" />

  <h1>⚡ Shipora</h1>
  <p><strong>Ship confidently. Zero conflicts. One click.</strong></p>

  <p>
    <a href="#overview">Overview</a> •
    <a href="#features">Features</a> •
    <a href="#tech-stack">Tech Stack</a> •
    <a href="#architecture">Architecture</a> •
    <a href="#getting-started">Getting Started</a> •
    <a href="#project-structure">Project Structure</a> •
    <a href="#agents">Agents</a> •
    <a href="#contributing">Contributing</a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/turborepo-monorepo-blueviolet?style=flat-square" />
    <img src="https://img.shields.io/badge/next.js-15-black?style=flat-square" />
    <img src="https://img.shields.io/badge/temporal-cloud-blue?style=flat-square" />
    <img src="https://img.shields.io/badge/aws-ecs%20fargate-orange?style=flat-square" />
    <img src="https://img.shields.io/badge/drizzle-orm-green?style=flat-square" />
    <img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" />
  </p>
</div>

---

## Overview

**Shipora** is a deployment simplifier for modern multi-service projects. The user already has their database, Redis, API keys, and everything else. Shipora's **only job** is to take their existing code and secrets and deploy it cleanly to AWS ECS — with zero conflicts, zero manual DevOps steps, and automatic rollback.

Think of it as an **AI Deployment Engineer** that:
- Reads your repository and automatically detects all services and how to build them
- Reads your `.env` file and securely injects secrets into the right ECS tasks
- Guards your `main` branch — blocks deploys if merge conflicts, missing secrets, or lock file issues are detected
- Orchestrates multi-service deployments on AWS ECS with zero-downtime releases
- Auto-rolls back in under 2 minutes if a health check fails

> **"Ship your app, not your DevOps problems."**

---

## Features

### 🔍 Project Intelligence
- Auto-detects all services in your repo (Next.js, Vite, Node/Express, FastAPI, Bun, Docker)
- Detects build commands per service automatically
- Maps which env vars are consumed by which service
- Generates a Deployment Readiness Report before any build starts

### 🔑 Secure Secret Management
- Upload your `.env` file once — Shipora stores it in **AWS Secrets Manager** (never plaintext)
- Secrets are injected directly into ECS tasks as encrypted references
- Update secrets from the dashboard — re-deploy triggered automatically
- Shipora never provisions or manages your database or infrastructure

### ⚔️ Conflict Guard
- Runs on every push to protected branches (GitHub App status check)
- Detects: unresolved merge conflicts, lock file inconsistencies, missing env vars in your `.env`
- Blocks the deploy pipeline until all checks pass — visible on both GitHub and the Shipora dashboard

### 🚀 Multi-Service Deploy Engine
- Parallel Docker image builds via **AWS CodeBuild** per service
- Deploy to **AWS ECS Fargate** — your `.env` injected securely to the right services
- Zero-downtime releases (old version stays live until new one is verified)

### 📡 Real-Time Observability
- Per-service live log streaming via Server-Sent Events (SSE)
- Deploy history and audit log
- Health check verification before traffic is switched

### 🔄 Auto Rollback
- Previous ECS task definition kept live until new one is verified
- Automatic rollback in < 2 min if health check fails
- Full rollback event log and user notification

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Monorepo** | Turborepo + pnpm |
| **Frontend** | Next.js 15 (App Router), Tailwind CSS, shadcn/ui |
| **Auth** | Clerk (GitHub OAuth) |
| **Backend API** | Fastify, tRPC, TypeScript |
| **Workflow Engine** | Temporal Cloud |
| **Container Runtime** | AWS ECS Fargate (user's apps) |
| **Docker Builds** | AWS CodeBuild |
| **Shipora's DB** | Neon Postgres + Drizzle ORM (internal only) |
| **Shipora's Queue** | Upstash Redis + BullMQ (internal only) |
| **GitHub Integration** | Octokit + GitHub App |
| **Code Analysis** | Tree-sitter |
| **User Secrets** | AWS Secrets Manager (user's `.env` — encrypted, never plaintext) |
| **Observability** | OpenTelemetry + Axiom |
| **IaC** | AWS CDK (TypeScript) |
| **CI/CD** | GitHub Actions |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   User Browser                      │
│              Next.js 15 Dashboard                   │
└────────────────────┬────────────────────────────────┘
                     │ tRPC / SSE
┌────────────────────▼─────────────────────────────────────┐
│              Fastify API (apps/api)                 │
│         tRPC Router + GitHub Webhooks               │
└────┬───────────────┬────────────────────────────────┘
     │               │
     ▼               ▼
Temporal Cloud    BullMQ (Upstash Redis)
     │             [Shipora's internal queue only]
     ▼
┌─────────────────────────────────────────────────────┐
│           Temporal Worker (apps/temporal-worker)   │
│                                                    │
└──────┬─────────────────────────┬──────────────────┘
       │                         │
       ▼                         ▼
  GitHub API               AWS ECS Fargate
  (Status Checks)          AWS CodeBuild
                           AWS Secrets Manager
                           Neon Postgres
```

For a deeper dive, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## Getting Started

### Prerequisites
- Node.js >= 20
- pnpm >= 9
- A GitHub App (see [docs/GITHUB_APP_SETUP.md](docs/GITHUB_APP_SETUP.md))
- A Clerk account
- A Temporal Cloud account
- AWS account with ECS, CodeBuild, and Secrets Manager access

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/shipora.git
cd shipora

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your .env values

# Run database migrations
pnpm db:migrate

# Start all apps in development mode
pnpm dev
```

### Running Individual Apps

```bash
# Frontend only
pnpm --filter web dev

# API only
pnpm --filter api dev

# Temporal worker only
pnpm --filter temporal-worker dev
```

---

## Project Structure

```
shipora/
├── apps/
│   ├── web/                   # Next.js 15 frontend (dashboard + landing)
│   ├── api/                   # Fastify + tRPC backend
│   └── temporal-worker/       # Temporal workflow activities
│
├── packages/
│   ├── db/                    # Drizzle ORM schema + Neon client
│   ├── temporal-workflows/    # Workflow & activity definitions
│   ├── github-app/            # Octokit GitHub App helpers
│   ├── code-analyzer/         # Tree-sitter static analysis
│   ├── ui/                    # Shared React component library
│   ├── config-typescript/     # Shared TypeScript configs
│   └── types/                 # Shared Zod schemas & types
│
├── infra/
│   └── aws-cdk/               # AWS CDK infrastructure stacks
│
├── docs/                      # Project documentation
│   ├── ARCHITECTURE.md
│   ├── AGENTS.md
│   ├── GITHUB_APP_SETUP.md
│   └── DEPLOYMENT.md
│
├── .github/workflows/         # GitHub Actions CI/CD
├── turbo.json
├── package.json
└── pnpm-workspace.yaml
```

---

## Agents

Shipora is powered by a set of specialized agents running as Temporal activities. See [docs/AGENTS.md](docs/AGENTS.md) for full details.

| Agent | Role |
|---|---|
| **Conflict Guard Agent** | Pre-deploy branch safety checker |
| **Code Analyzer Agent** | Repo structure + framework detection |
| **Build Agent** | Docker image builds via AWS CodeBuild |
| **Provision Agent** | AWS ECS Fargate task + service creation |
| **Service Wiring Agent** | Inter-service env injection + CORS config |
| **Health Monitor Agent** | Post-deploy verification + traffic switch |
| **Rollback Agent** | Automatic rollback on failed health checks |
| **GitHub Status Agent** | Posts check results back to GitHub |
| **Log Streaming Agent** | Real-time log forwarding to dashboard via SSE |
| **Secret Sync Agent** | Syncs secrets from AWS Secrets Manager to ECS |

---

## Roadmap

For a comprehensive technical breakdown of all phases, see [**docs/ROADMAP_PHASES.md**](docs/ROADMAP_PHASES.md).

### Phase 1 — Foundation ✅ (Completed)
- Monorepo scaffold & Turborepo pipelines
- Clerk auth + GitHub OAuth
- Drizzle ORM schema + Neon DB client
- Fastify tRPC backend API
- Next.js 15 App Router dashboard
- 4-step GitHub App onboarding flow
- Complete Vitest & Playwright E2E test suites

### Phase 2 — Conflict Guard (Pre-Deploy Safety)
- Temporal Cloud worker connection
- Tree-sitter static analysis engine
- Unresolved merge conflict scanner
- Lockfile integrity & health scanner
- AWS Secrets Manager key validation
- GitHub Commit Status Checks (`shipora/conflict-guard`)

### Phase 3 — Multi-Service Deploy Engine
- AWS CDK infrastructure (VPC, ECS Cluster, ALB, ECR, CodeBuild)
- Parallel Docker container builds via AWS CodeBuild
- Multi-service deployment to AWS ECS Fargate
- Per-service secret injection (`valueFrom` references)
- Application Load Balancer path & subdomain routing

### Phase 4 — Observability & Auto-Rollback
- Upstash Redis pub/sub real-time SSE log streaming
- HTTP post-deploy health check verification
- Automatic rollback in < 2 min on failed checks
- Deployment history, audit trail & manual rollback trigger

### Phase 5 — Teams & Collaboration
- Organization accounts & multi-tenancy
- Team member invites & Role-Based Access Control (Admin, Developer, Viewer)

### Phase 6 — Post-MVP Advanced Features
- Ephemeral preview environments per pull request
- Custom domains & automated SSL (Route53 + ACM)
- Bring Your Own Cloud (BYOC) for user AWS accounts
- Multi-cloud deploy adapters (Vercel, Lambda, S3+CloudFront)
- Shipora CLI (`@shipora/cli`)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

---

## License

MIT © Shipora
