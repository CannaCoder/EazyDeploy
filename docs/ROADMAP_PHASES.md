# Shipora — Master Product Roadmap & Implementation Phases

This document provides a comprehensive, phase-by-phase architectural blueprint for **Shipora**. It details the goals, exact component responsibilities, data flows, Temporal agents/activities, testing criteria, and deliverables for each phase of the platform's lifecycle.

---

## Roadmap Overview

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 1: Foundation & Onboarding (✅ Complete)                                   │
│  Monorepo Scaffold • Clerk Auth • Neon DB • Fastify tRPC API • Next.js 15 Web   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 2: Conflict Guard Pre-Deploy Engine                                       │
│  Temporal Cloud Worker • Tree-sitter Code Analyzer • Conflict & Lockfile Scanners│
│  AWS Secrets Validation • GitHub App Status Checks                               │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 3: Multi-Service Deploy Engine (✅ Complete)                              │
│  AWS CodeBuild Container Builds • ECR Image Registry • ECS Fargate Provisioner   │
│  Per-Service Secret Slicing • Application Load Balancer Path/Subdomain Routing   │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 3.5: Multi-Cloud Provider Framework & Azure Support                       │
│  Provider Adapter Pattern • AWS CloudFormation Connect • Azure AD OAuth          │
│  Azure Container Apps Adapter • Smart .env Auto-Detection • Cloud Connection Mgmt│
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 4: Observability, SSE Live Logs & Auto-Rollback                           │
│  Redis Pub/Sub SSE Log Streaming • Health Check Pollers • 2-Min Auto-Rollback   │
│  Deploy Audit History • Manual Rollback Trigger                                  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 5: Teams, Organizations & Access Control                                  │
│  Multi-tenant Organizations • Role-Based Access (Admin/Dev/Viewer) • Audit Logs  │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│  Phase 6: Post-MVP Advanced Features                                             │
│  Preview Environments per PR • Custom Domains (Route53/ACM) • BYOC              │
│  DigitalOcean & GCP Adapters • Shipora CLI • Vercel/Lambda/S3 Adapters          │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1 — Foundation & Onboarding ✅

### Goal
Establish the core monorepo architecture, shared type safety contracts, database schemas, API layer, and authenticated dashboard with a 4-step GitHub App onboarding flow.

### Status
**Completed & Verified** (36/36 Unit & Integration Tests, 3/3 Playwright E2E Tests, Next.js 15 Production Build).

### Deliverables & Architecture

1. **Layer 1: Shared Packages**
   - `@shipora/config-typescript`: Base, Node.js, and Next.js `tsconfig` templates.
   - `@shipora/types`: Zod schemas and TypeScript types for `User`, `Project`, `Service`, `Deployment`, `ConflictCheck`, and `AuditLog`.
   - `@shipora/db`: Drizzle ORM schema for PostgreSQL, Neon serverless client, and migration scripts.
   - `@shipora/ui`: Design system components (`Button`, `Card`, `Badge`, `Avatar`, `Spinner`, `cn` utility) based on Tailwind CSS and modern dark-mode tokens.
   - `@shipora/github-app`: Octokit GitHub App integration client and HMAC-SHA256 signature verification.
   - `@shipora/temporal-workflows`: Shared contracts for Temporal workflows and activities.
   - `@shipora/code-analyzer`: Parser type definitions and detection stubs.

2. **Layer 2: Backend API & Auth (`apps/api`)**
   - Fastify HTTP server with CORS and raw body support for webhook verification.
   - tRPC Router implementing:
     - `user.sync`: Upserts user details from Clerk JWT.
     - `project.list`: Retrieves projects owned by the authenticated developer.
     - `project.create`: Validates repository parameters and stores project records.
     - `project.getById`: Returns project metadata and associated services.
   - REST Routes: `GET /health`, `POST /webhooks/github`, `GET /github/repos`.

3. **Layer 3: Next.js 15 Web Dashboard (`apps/web`)**
   - Landing page showcasing hero, conflict guard visualization, and quick start CTA.
   - Dark theme layout with sidebar navigation (`Overview`, `Projects`, `Deployments`, `Conflict Guard`).
   - Project overview page with real-time status indicators and project cards.
   - 4-Step Onboarding Wizard (`/dashboard/new-project`):
     - Step 1: Install Shipora GitHub App.
     - Step 2: Select repository from accessible installations.
     - Step 3: Choose production branch (default: `main`).
     - Step 4: Complete connection and redirect to project details.
   - Project Details Page (`/dashboard/projects/[id]`).

4. **Testing Infrastructure**
   - Vitest workspace configuration covering all packages.
   - Playwright browser test suite with automated server orchestration (`pnpm test:e2e`).
   - CI workflows: `.github/workflows/ci.yml` and `.github/workflows/test.yml`.

---

## Phase 2 — Conflict Guard Pre-Deploy Engine

### Goal
Provide automated pre-deploy safety by intercepting every push to protected branches via GitHub webhooks, executing durable Temporal workflows to scan code for conflicts, lockfile issues, and missing secrets, and posting instant status checks back to GitHub (`shipora/conflict-guard`).

```
GitHub Push Webhook
        │
        ▼
   apps/api (Verify Signature & Store Audit Log)
        │
        ▼
   Temporal Cloud (ConflictGuardWorkflow)
   ├── Activity 1: analyzeRepo (Tree-sitter AST parser)
   ├── Activity 2: scanMergeConflicts (Git marker detector)
   ├── Activity 3: scanLockfileHealth (Lockfile integrity check)
   ├── Activity 4: validateEnvVars (AWS Secrets Manager keys diff)
   └── Activity 5: reportGitHubStatus (Octokit commit status check)
        │
        ▼
GitHub Commit Status Check (✅ Passed / ❌ Failed with dashboard breakdown)
```

### Key Components & Files

1. **Temporal Cloud Worker (`apps/temporal-worker`)**
   - `src/worker.ts`: Connects to Temporal Cloud via mTLS credentials (`TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, certificates).
   - Registers `ConflictGuardWorkflow` and activity implementations.

2. **Static Analysis Engine (`packages/code-analyzer`)**
   - `src/parser.ts`: Tree-sitter parsers for TypeScript, JavaScript, Python, and Dockerfiles.
   - `src/detectors/env.ts`: Scans code for references to `process.env.*`, `import.meta.env.*`, and `os.environ[*]`.
   - `src/detectors/framework.ts`: Detects Next.js, Vite, Fastify, Express, FastAPI, Bun, and custom Docker setups.

3. **Conflict Guard Activities (`packages/temporal-workflows` & `apps/temporal-worker`)**
   - `activities/analyzeRepo.ts`: Fetches repo file tree via GitHub Octokit and outputs service manifest.
   - `activities/scanMergeConflicts.ts`: Scans all text files for unresolved conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`).
   - `activities/scanLockfileHealth.ts`: Checks `pnpm-lock.yaml` / `package-lock.json` against `package.json` for integrity and missing dependencies.
   - `activities/validateEnvVars.ts`: Compares required environment variable keys detected in code against the keys uploaded in AWS Secrets Manager (reads key names only, never values).
   - `activities/reportGitHubStatus.ts`: Posts commit status back to GitHub via `repos.createCommitStatus` with state `pending`, `success`, or `failure`.

4. **Dashboard Views (`apps/web`)**
   - `/dashboard/projects/[id]/checks`: Visual report of Conflict Guard check results per commit, highlighting offending files and missing environment keys.

### Testing & Verification Plan
- **Unit Tests**: Tree-sitter AST parsing on sample Next.js/Fastify monorepos; conflict scanner on synthetic conflict files; lockfile parser tests.
- **Integration Tests**: Mocked GitHub Octokit and Temporal test environment (`@temporalio/testing`) running `ConflictGuardWorkflow` end-to-end.
- **Verification Checkpoint**: Pushing a commit with an intentional conflict marker causes GitHub status check to turn red (`shipora/conflict-guard: ❌ failed`) with full details in the dashboard.

---

## Phase 3 — Multi-Service Deploy Engine ✅

### Goal
Implement automated container building via AWS CodeBuild and containerized deployment to AWS ECS Fargate, supporting monorepos with multiple services (e.g. Next.js web + Fastify API + workers) with zero manual infrastructure configuration.

### Status
**Completed & Verified** (54/54 Unit & Integration Tests across CDK stacks, Temporal deploy activities, tRPC router, and Next.js 15 production build).

```
Deploy Trigger (User Click or Auto on ConflictGuard Pass)
        │
        ▼
Temporal Cloud (DeployWorkflow)
   ├── Activity 1: analyzeRepo (Service Discovery)
   ├── Activity 2: buildContainer (AWS CodeBuild in Parallel per Service)
   │     ├── Service A (Web) -> Docker Build -> AWS ECR
   │     └── Service B (API) -> Docker Build -> AWS ECR
   ├── Activity 3: syncSecrets (AWS Secrets Manager -> ECS task valueFrom refs)
   ├── Activity 4: provisionECS (Register Task Defs & Update ECS Services)
   └── Activity 5: attachLoadBalancer (Configure ALB Target Groups & Subdomain Rules)
```

### Key Components & Files

1. **AWS CDK Infrastructure (`infra/aws-cdk`)**
   - `lib/vpc-stack.ts`: VPC, public & private subnets, security groups.
   - `lib/ecs-cluster-stack.ts`: Shared ECS Fargate Cluster & Application Load Balancer (ALB).
   - `lib/ecr-stack.ts`: AWS ECR repositories for container images.
   - `lib/codebuild-stack.ts`: AWS CodeBuild project configured for Docker layer caching.
   - `lib/secrets-stack.ts`: IAM execution roles with least-privilege access to AWS Secrets Manager.

2. **Secret Management Flow**
   - `apps/web`: Secure `.env` upload dialog.
   - `apps/api`: Encrypts `.env` and stores it in AWS Secrets Manager (`shipora/projects/{projectId}/env`).
   - `packages/temporal-workflows/src/activities/syncSecrets.ts`: Slices secrets per service (only passing variables required by each service) as encrypted `valueFrom` task definition references.

3. **Deploy Workflow Activities (`apps/temporal-worker`)**
   - `activities/buildContainer.ts`: Starts AWS CodeBuild builds with commit SHA source overrides and polls build status.
   - `activities/provisionECS.ts`: Registers new ECS Task Definitions with CPU/memory sizing, port mappings, and environment references.
   - `activities/updateService.ts`: Updates ECS Services to schedule new task revisions.

4. **Web UI Updates (`apps/web`)**
   - "Deploy Release" button on project dashboard.
   - Deployment progress stepper (Analyzing → Building Containers → Provisioning ECS → Verifying).

### Testing & Verification Plan
- **Unit Tests**: AWS SDK payload builders for ECS Task Definitions and CodeBuild parameters.
- **Integration Tests**: Verification of AWS SDK mock calls during `DeployWorkflow`.
- **Manual Checkpoint**: Deploying a sample monorepo with web (port 3000) and api (port 4000) results in live, running containers on ECS behind ALB subdomains.

---

## Phase 3.5 — Multi-Cloud Provider Framework & Azure Support

### Goal
Refactor the AWS-specific deploy engine into a cloud-agnostic **Provider Adapter Pattern**, add Azure as the second supported cloud provider via Azure AD OAuth, and implement a smart `.env` auto-detection flow that parses `.env.example` to guide users through secret configuration.

**MVP Scope**: Build the multi-cloud adapter interface now and **ship 2 fully working clouds** (AWS + Azure). This phase is NOT just abstraction work — both adapters must be functional and deployable. The adapter interface must be designed with DigitalOcean and GCP in mind so adding them in Phase 6 is plug-and-play.

### Architecture Decisions
- **Secret Storage**: Secrets are stored in the **target cloud's native vault** (AWS Secrets Manager for AWS, Azure Key Vault for Azure). For providers without native vaults (DigitalOcean), secrets are encrypted in Shipora's vault and pushed at deploy time (see Phase 6).
- **Auth Model**: AWS uses **CloudFormation one-click** IAM role creation; Azure uses **OAuth 2.0 via Azure AD** with auto-created Service Principal.
- **Credential Storage**: Role ARNs (AWS) encrypted in database; Azure Service Principal client credentials stored in Shipora's AWS Secrets Manager with background expiry tracking.
- **Connection Scope**: Account-level default with per-project override capability.
- **Cloud Management Level**: **Level 2 — Full Infrastructure Lifecycle**. Shipora manages the complete lifecycle of resources it creates (create, scale, teardown, monitor), but never touches resources it didn't create or account-level settings (billing, root IAM, etc.).

### Level 2 Cloud Management Capabilities

Shipora manages the full lifecycle of deployed resources across all connected clouds:

| Capability | AWS | Azure |
|---|---|---|
| **Create infrastructure** on deploy | ECS services, task defs, ALB rules, ECR repos | Container Apps, ACR repos, Key Vault entries |
| **Scale services** up/down | Update ECS `desiredCount`, Application Auto Scaling policies | Update Container App replica count, KEDA scaling rules |
| **Tear down** on project delete | Delete ECS services, task defs, ECR images, ALB target groups | Delete Container Apps, ACR repos, resource group cleanup |
| **Read metrics** (CPU, memory, requests) | CloudWatch `GetMetricData` | Azure Monitor metrics API |
| **Read cost data** per project | AWS Cost Explorer API (tag-based filtering) | Azure Cost Management API |
| **Manage DNS/SSL** | Route53 + ACM | Azure DNS + App Service Certificates |

**Resource Tagging Strategy**: Every resource Shipora creates is tagged with:
- `shipora:managed-by` = `shipora`
- `shipora:project-id` = `{projectId}`
- `shipora:service-id` = `{serviceId}`
- `shipora:environment` = `production` | `preview`

This ensures Shipora **never modifies resources it didn't create** and enables accurate per-project cost attribution.

**Additional IAM Permissions for Level 2 (AWS):**
- `application-autoscaling:*` — Auto-scaling policies
- `cloudwatch:GetMetricData`, `cloudwatch:ListMetrics` — Read metrics
- `ce:GetCostAndUsage` — Cost tracking
- `route53:ChangeResourceRecordSets` — DNS management
- `acm:RequestCertificate`, `acm:DescribeCertificate` — SSL certificates

**Additional RBAC Roles for Level 2 (Azure):**
- `Monitoring Reader` — Read metrics from Azure Monitor
- `Cost Management Reader` — Read cost/usage data
- `DNS Zone Contributor` — Custom domain DNS management

```
Deploy Trigger (User Click or Auto on ConflictGuard Pass)
        │
        ▼
┌───────────────────────────────────────────────────────────┐
│  Temporal Cloud (DeployWorkflow — Cloud-Agnostic)         │
│                                                           │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  CloudProviderAdapter Interface                     │  │
│  │  ├── authenticate()     → STS AssumeRole / Azure AD │  │
│  │  ├── buildImage()       → CodeBuild / ACR Tasks     │  │
│  │  ├── pushSecrets()      → Secrets Mgr / Key Vault   │  │
│  │  ├── provisionService() → ECS Fargate / Cont. Apps  │  │
│  │  └── configureIngress() → ALB / Azure Front Door    │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                           │
│  Resolved at runtime via project.cloud_provider field     │
└───────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌──────────────────┐    ┌──────────────────────────┐
│  AWS Adapter     │    │  Azure Adapter            │
│  (Existing Logic │    │  Container Apps + ACR     │
│   Refactored)    │    │  + Key Vault + Front Door │
└──────────────────┘    └──────────────────────────┘
```

### Key Components & Files

1. **Provider Adapter Interface (`packages/cloud-adapters`)**
   - `src/adapter.ts`: Abstract `CloudProviderAdapter` interface with methods: `authenticate()`, `buildImage()`, `pushSecrets()`, `provisionService()`, `configureIngress()`, `getDeploymentStatus()`.
   - `src/types.ts`: Cloud-agnostic types for `CloudConnection`, `BuildResult`, `ProvisionResult`, `IngressConfig`.
   - `src/aws/index.ts`: AWS adapter implementing the interface (refactored from Phase 3 activities).
   - `src/azure/index.ts`: Azure adapter implementing the interface.

2. **AWS CloudFormation Connect Flow**
   - `infra/aws-cdk/lib/cf-connect-template.yaml`: CloudFormation template that creates a scoped IAM role with ExternalId trust policy.
   - `apps/api/src/routes/cloud-connect.ts`: REST endpoints for generating CloudFormation console URLs and verifying role ARN connectivity.
   - `apps/web/src/components/cloud-connect/aws-connect-wizard.tsx`: Step-by-step wizard UI for CloudFormation one-click role creation.

3. **Azure OAuth & Service Principal Flow**
   - `apps/api/src/routes/azure-oauth.ts`: OAuth 2.0 authorization code flow endpoints (`/auth/azure/start`, `/auth/azure/callback`).
   - `apps/api/src/services/azure-service-principal.ts`: Auto-creates Azure AD Service Principal with scoped RBAC (Contributor on deploy Resource Group).
   - `apps/web/src/components/cloud-connect/azure-connect-wizard.tsx`: OAuth consent flow UI.

4. **Smart `.env` Auto-Detection**
   - `packages/code-analyzer/src/detectors/env-example.ts`: Parses `.env.example` from GitHub repo to extract key names, default values, and inline comments as descriptions.
   - `apps/web/src/components/deploy/smart-env-form.tsx`: Dynamic form generated from `.env.example` schema — shows required keys, descriptions, and validates completeness. Also supports raw paste detection (if user pastes `KEY=value` pairs, auto-parses into form fields).

5. **Database Schema (`packages/db`)**
   - `cloud_connections` table: `id`, `user_id`, `project_id` (nullable for account-level), `provider` (`aws` | `azure`), `role_arn`, `external_id`, `tenant_id`, `client_id`, `client_secret`, `subscription_id`, `status`, `connected_at`, `expires_at`, `last_used_at`.
   - `projects` table update: Add `cloud_provider` column (`aws` | `azure`, default `aws`).

6. **Cloud Connection Management UI (`apps/web`)**
   - `/dashboard/settings/cloud-connections`: Manage connected cloud accounts, connection health status, disconnect/reconnect actions.
   - `/dashboard/new-project` update: Step 3 becomes "Select Cloud Provider" with AWS/Azure cards before branch selection.
   - Provider selection cards on project dashboard with connection status indicators.

### Testing & Verification Plan
- **Unit Tests**: Provider adapter interface compliance tests for both AWS and Azure adapters with mocked SDK calls. `.env.example` parser tests across various formats.
- **Integration Tests**: Full DeployWorkflow execution with each adapter using mocked cloud SDKs via `@temporalio/testing`.
- **Manual Checkpoint**: Connecting an Azure account via OAuth, uploading secrets detected from `.env.example`, and deploying a sample app to Azure Container Apps.

---

## Phase 4 — Observability, SSE Live Logs & Auto-Rollback

### Goal
Provide real-time deployment visibility via Server-Sent Events (SSE), post-deploy HTTP health check verification, and automatic rollback in under 2 minutes if container startup or health checks fail.

```
Container Provisioned
        │
        ▼
Health Monitor Activity (Polls /health endpoint every 10s for up to 5 min)
        │
   ┌────┴────┐
   │         │
PASS       FAIL
   │         │
   ▼         ▼
Switch     Rollback Activity
Traffic    (Reverts ECS Service to previousTaskDefinitionArn in < 2 min)
   │         │
   ▼         ▼
Success    Dashboard Notification & Rollback Audit Event
```

### Key Components & Files

1. **Real-Time Log Streaming Pipeline**
   - `apps/temporal-worker`: Streams build and container logs to Upstash Redis pub/sub channels (`deployments:{id}:logs`).
   - `apps/api/src/routes/logs.ts`: Fastify SSE endpoint (`GET /deployments/:id/logs`) subscribing to Redis channel.
   - `apps/web/src/components/log-viewer.tsx`: Real-time terminal log viewer with per-service tabs and colorized ANSI output.

2. **Health Verification & Auto-Rollback Activities**
   - `activities/verifyDeployment.ts`: Polls service health endpoints (`/health` or `/`) and checks ECS task stability.
   - `activities/rollback.ts`: If health verification fails or times out, immediately issues `ecs.updateService` pointing back to `previousTaskDef` with `forceNewDeployment: true`.

3. **Deployment Audit & History (`apps/web`)**
   - `/dashboard/projects/[id]/deployments`: Chronological deployment history, commit metadata, build durations, and rollback logs.
   - Manual "Rollback to this version" action button.

### Testing & Verification Plan
- **Integration Tests**: SSE streaming endpoint tests using EventSource clients; Redis pub/sub relay verification.
- **SLA Benchmark Test**: Rollback activity timed to ensure completion in `< 120 seconds`.
- **Failure Simulation**: Deploying a container with an intentional failing health check triggers the automatic rollback flow and restores previous task definition.

---

## Phase 5 — Teams, Organizations & Access Control

### Goal
Enable team collaboration, organization-level workspace sharing, and role-based permissions (Admin, Developer, Viewer) for enterprise monorepo management.

### Key Deliverables

1. **Database Extensions (`packages/db`)**
   - `organizations` table: `id`, `name`, `slug`, `avatar_url`, `plan`.
   - `organization_members` table: `organization_id`, `user_id`, `role` (`owner` | `admin` | `member` | `viewer`).
   - `projects.organization_id`: Foreign key linking projects to organizations.

2. **Auth & RBAC Middleware (`apps/api`)**
   - Clerk organization integration (`req.auth.orgId`, `req.auth.orgRole`).
   - Permissions guard middleware ensuring developers can deploy while viewers can only monitor logs.

3. **Organization Management UI (`apps/web`)**
   - Workspace selector dropdown in header.
   - Team member invite modal and role management settings page.

---

## Phase 6 — Post-MVP Advanced Features

### Features & Capabilities

1. **Ephemeral Preview Environments per PR**
   - Spawns isolated container tasks and unique subdomains (`pr-42.myapp.shipora.app`) on pull request open.
   - Works across all connected cloud providers (ECS Fargate / Azure Container Apps).
   - Automatically tears down infrastructure when PR is merged or closed.

2. **Custom Domains & Automated SSL**
   - Integration with AWS Route53/ACM and Azure DNS/App Service Certificates.
   - One-click custom domain mapping (`app.customdomain.com` -> cloud provider ingress CNAME).

3. **DigitalOcean & GCP Cloud Adapters**
   - Plugs into the existing `CloudProviderAdapter` interface established in Phase 3.5.
   - Both providers support proper OAuth 2.0, making the connect flow smoother than AWS.

   **DigitalOcean Adapter:**
   - **Auth**: OAuth 2.0 via `cloud.digitalocean.com/v1/oauth/authorize` → access token + refresh token (refresh tokens never expire unless revoked).
   - **Deploy Target**: DigitalOcean App Platform via DO API.
   - **Container Registry**: DigitalOcean Container Registry (DOCR).
   - **Secrets Strategy (Option C — Shipora Vault + Push at Deploy Time):**
     - ⚠️ DigitalOcean has **no native secrets vault** (no KMS, no encryption at rest).
     - Secrets are stored **encrypted in Shipora's AWS Secrets Manager** (`shipora/projects/{projectId}/env`).
     - At deploy time, the DO adapter **decrypts and pushes** env vars to App Platform API with `type: "SECRET"` (write-only, masked in DO dashboard, but not KMS-encrypted by DO internally).
     - Dashboard must show a **security disclaimer**: "DigitalOcean does not provide an encrypted secrets vault. Your env vars are encrypted in Shipora's vault and pushed as masked secrets to DO App Platform at deploy time."
   - **Level 2 Management**: Scale via App Platform API, teardown via `apps.delete()`, metrics via DO Monitoring API.
   - **Shipora Requirements**: Register OAuth App at DO developer portal → `DO_CLIENT_ID` + `DO_CLIENT_SECRET` env vars.

   **GCP Adapter:**
   - **Auth**: Google OAuth 2.0 via `accounts.google.com/o/oauth2/v2/auth` → access token + refresh token → auto-create Service Account (`shipora-deploy@{project}.iam.gserviceaccount.com`) with scoped IAM roles.
   - **Service Account Roles**: `roles/run.admin`, `roles/artifactregistry.writer`, `roles/secretmanager.admin`, `roles/monitoring.viewer`.
   - **Deploy Target**: Google Cloud Run (managed).
   - **Container Registry**: Google Artifact Registry.
   - **Secrets**: GCP Secret Manager (native vault, KMS-encrypted — same model as AWS/Azure, secrets stored directly in user's cloud).
   - **Extra Step**: After OAuth, user selects which GCP Project to connect (Shipora lists projects via Resource Manager API).
   - **Level 2 Management**: Scale via Cloud Run API, teardown via `services.delete()`, metrics via Cloud Monitoring API, cost via Cloud Billing API.
   - **Shipora Requirements**: Configure OAuth consent screen in GCP Console → `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars. Enable APIs: Cloud Run, Artifact Registry, Secret Manager, Cloud Resource Manager.

   **Auth Flow Comparison (All 4 Providers):**

   | Aspect | AWS | Azure | DigitalOcean | GCP |
   |--------|-----|-------|-------------|-----|
   | Auth type | CloudFormation one-click | OAuth 2.0 (Azure AD) | OAuth 2.0 | OAuth 2.0 (Google) |
   | UX friction | Medium (leaves app) | Low | Lowest | Low |
   | What we get | IAM Role ARN | Service Principal | OAuth token | Service Account |
   | Token expiry | Never (role-based) | ~1-2 yrs (client secret) | Never (until revoked) | Never (SA key) |
   | Secrets vault | ✅ Secrets Manager | ✅ Key Vault | ❌ None (Shipora vault) | ✅ Secret Manager |
   | Container service | ECS Fargate | Container Apps | App Platform | Cloud Run |
   | Image registry | ECR | ACR | DOCR | Artifact Registry |

4. **Bring Your Own Cloud (BYOC) Enhancements**
   - Cross-account IAM role support for AWS (extends CloudFormation connect from Phase 3.5).
   - Azure Lighthouse integration for managed service provider scenarios.
   - Resource tagging and cost isolation per Shipora project.

5. **Additional Deploy Target Adapters**
   - Deploy adapters for non-container targets based on optional `shipora.yaml`:
     - **Vercel Adapter**: Deploy Next.js frontend to Vercel via Vercel REST API.
     - **AWS Lambda / API Gateway Adapter**: Serverless deployment for lightweight endpoints.
     - **S3 + CloudFront Adapter**: Static export hosting for Vite/SPA apps.

6. **Shipora CLI (`@shipora/cli`)**
   - `shipora login`, `shipora status`, `shipora deploy`, `shipora logs --follow`.
   - `shipora secrets push --env-file .env` for CLI-based secret upload.
   - `shipora connect aws|azure|do|gcp` for cloud account connection.

---

## Summary Matrix

| Phase | Core Objective | Primary Technologies | Target Deliverables |
|---|---|---|---|
| **Phase 1** ✅ | Foundation, Auth & Monorepo Setup | Next.js 15, Fastify, tRPC, Drizzle, Neon, Clerk | Shared packages, DB schema, Onboarding flow, Test suites |
| **Phase 2** | Pre-Deploy Conflict Guard | Temporal Cloud, Tree-sitter, Octokit, AWS Secrets | Code analyzer, Lockfile checker, GitHub status check |
| **Phase 3** ✅ | Multi-Service Deploy Engine | AWS ECS Fargate, CodeBuild, ECR, AWS CDK | Parallel container builds, Task Def provisioner, ALB routing |
| **Phase 3.5** | Multi-Cloud Framework & Azure | Provider Adapters, Azure AD OAuth, CloudFormation, Azure Container Apps | Cloud adapter interface, AWS/Azure connect flows, Smart .env detection |
| **Phase 4** | Observability & Auto-Rollback | Upstash Redis, SSE, CloudWatch, OpenTelemetry | Real-time log streaming, Health checks, < 2 min rollback |
| **Phase 5** | Teams & Organization Management | Clerk Organizations, RBAC, PostgreSQL | Multi-tenant orgs, Member invites, Role permissions |
| **Phase 6** | Post-MVP: DO/GCP, Preview Envs, CLI | DigitalOcean API, GCP Cloud Run, Route53/ACM, Vercel API | DO & GCP adapters, Preview envs, Custom domains, BYOC, CLI |
