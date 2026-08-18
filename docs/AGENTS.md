# Agents & Subagents — Shipora

This document describes every agent and subagent in the Shipora system, their responsibilities, inputs/outputs, failure modes, and how they communicate.

---

## Overview

Shipora is built on **Temporal Cloud** as its durable workflow engine. Every agent in the system is a **Temporal Activity** — a discrete, retryable, isolated unit of work. Agents are grouped into two **Temporal Workflows** that orchestrate them:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ConflictGuardWorkflow` | GitHub push webhook | Pre-deploy safety check |
| `DeployWorkflow` | User action / auto-trigger | Full multi-service deployment |

---

## Workflow 1: ConflictGuardWorkflow

**Trigger:** Every push to a protected branch (e.g., `main`, `staging`)
**Goal:** Ensure the branch is safe to deploy before any build starts

```
ConflictGuardWorkflow
├── Agent 1: Code Analyzer Agent
├── Agent 2: Merge Conflict Scanner Agent
├── Agent 3: Lock File Health Agent
├── Agent 4: Env Var Validator Agent
└── Agent 5: GitHub Status Reporter Agent
```

### Agent 1 — Code Analyzer Agent
**File:** `packages/code-analyzer`
**Activity:** `analyzeRepo`

| | |
|---|---|
| **Purpose** | Analyzes the repository to detect all services, frameworks, env var requirements, and inter-service dependencies |
| **Input** | `{ repoOwner, repoName, commitSha, installationId }` |
| **Output** | `{ services[], envVarRequirements{}, serviceRelations[] }` |
| **How** | Fetches repo file tree via GitHub API, runs Tree-sitter parsers on JS/TS/Python files, detects `process.env.*`, `import.meta.env.*`, and framework-specific patterns |
| **Retry** | 3 retries, 10s backoff |

---

### Agent 2 — Merge Conflict Scanner Agent
**Activity:** `scanMergeConflicts`

| | |
|---|---|
| **Purpose** | Scans all text files in the repo for unresolved Git conflict markers |
| **Input** | `{ repoOwner, repoName, commitSha, installationId }` |
| **Output** | `{ hasConflicts: boolean, conflictingFiles: string[] }` |
| **How** | Fetches repo tree, searches file contents for `<<<<<<< HEAD`, `=======`, `>>>>>>> ` markers |
| **Retry** | 3 retries, 5s backoff |

---

### Agent 3 — Lock File Health Agent
**Activity:** `scanLockfileHealth`

| | |
|---|---|
| **Purpose** | Checks that lock files (`pnpm-lock.yaml`, `package-lock.json`, `yarn.lock`) are consistent with `package.json` manifests |
| **Input** | `{ repoOwner, repoName, commitSha, installationId }` |
| **Output** | `{ healthy: boolean, issues: string[] }` |
| **How** | Fetches lock file content, parses workspace dependencies, checks for version mismatches and missing entries |
| **Retry** | 2 retries, 5s backoff |

---

### Agent 4 — Env Var Validator Agent
**Activity:** `validateEnvVars`

| | |
|---|---|
| **Purpose** | Confirms that every env var referenced in the code exists in the user's uploaded `.env` (stored in AWS Secrets Manager) |
| **Input** | `{ projectId, detectedEnvVars: string[] }` |
| **Output** | `{ valid: boolean, missingVars: string[] }` |
| **How** | Fetches the list of keys from the user's secret in AWS Secrets Manager, diffs against the list of env vars detected by the Code Analyzer. Does NOT read values — only key names |
| **Retry** | 3 retries, 5s backoff |

---

### Agent 5 — GitHub Status Reporter Agent
**Activity:** `reportGitHubStatus`

| | |
|---|---|
| **Purpose** | Posts the final check result back to GitHub as a Commit Status Check |
| **Input** | `{ repoOwner, repoName, commitSha, installationId, result: 'success' \| 'failure', summary, failureDetails[] }` |
| **Output** | `{ posted: boolean }` |
| **How** | Uses Octokit `repos.createCommitStatus` with context `shipora/conflict-guard` |
| **On failure** | Posts a `failure` status with a link to the Shipora dashboard for details |
| **Retry** | 5 retries, 2s backoff |

---

## Workflow 2: DeployWorkflow

**Trigger:** User clicks Deploy (or auto-triggered after ConflictGuard passes)
**Goal:** Build, provision, inject secrets, and verify a full multi-service deployment

```
DeployWorkflow
├── Agent 1: Code Analyzer Agent       (reused from ConflictGuard)
├── Agent 2: Build Agent               (per service, parallel)
├── Agent 3: Provision Agent           (per service)
├── Agent 4: Secret Inject Agent       (user's .env → ECS)
├── Agent 5: Health Monitor Agent
└── Agent 6: Rollback Agent            (triggered only on failure)
```

> **Note:** Shipora does NOT manage inter-service wiring. Users define their own service-to-service URLs in their `.env` file.

---

### Agent 7 — Build Agent
**Activity:** `buildContainer`

| | |
|---|---|
| **Purpose** | Builds a Docker image for a given service and pushes it to ECR |
| **Input** | `{ serviceId, repoOwner, repoName, commitSha, buildContext, ecrRepoUri }` |
| **Output** | `{ imageUri: string, buildLogUrl: string }` |
| **How** | Triggers AWS CodeBuild project with source override pointing to the GitHub commit; CodeBuild runs Dockerfile, tags the image `<ecr-uri>:<commitSha>`, and pushes to ECR |
| **Timeout** | 30 minutes |
| **Retry** | 2 retries (build failures are often not retriable — reports error immediately) |

---

### Agent 8 — Provision Agent
**Activity:** `provisionECS`

| | |
|---|---|
| **Purpose** | Creates or updates an ECS Task Definition and Service for the given service |
| **Input** | `{ serviceId, imageUri, cpu, memory, port, envVars[], ecsClusterArn }` |
| **Output** | `{ taskDefinitionArn: string, serviceArn: string, serviceUrl: string }` |
| **How** | Uses AWS SDK `ecs.registerTaskDefinition` + `ecs.createService` / `ecs.updateService`. Attaches to the shared Application Load Balancer with a unique path/subdomain |
| **Retry** | 3 retries, 15s backoff |

---

### Agent 9 — Secret Sync Agent
**Activity:** `syncSecrets`

| | |
|---|---|
| **Purpose** | Injects the user's existing `.env` secrets into the ECS task definition |
| **Input** | `{ serviceId, secretArns[], taskDefinitionArn }` |
| **Output** | `{ injected: boolean, updatedTaskDefinitionArn: string }` |
| **How** | Fetches the secret ARN from AWS Secrets Manager and configures the ECS task definition to pull these values at runtime (never stored in plain text in the repo or task config) |
| **Retry** | 3 retries, 5s backoff |

---

### Agent 10 — Health Monitor Agent
**Activity:** `verifyDeployment`

| | |
|---|---|
| **Purpose** | Verifies that all deployed services are healthy before switching traffic |
| **Input** | `{ services: { id, url, healthPath }[] }` |
| **Output** | `{ healthy: boolean, failedServices: string[] }` |
| **How** | Polls each service's health endpoint (`/health` or `/`) every 10s for up to 5 minutes. All services must return HTTP 2xx. Uses ECS service stability check as a secondary signal |
| **Timeout** | 6 minutes |
| **Retry** | No retry (failure triggers RollbackAgent) |

---

### Agent 11 — Rollback Agent
**Activity:** `rollback`

| | |
|---|---|
| **Purpose** | Reverts all services to their previous known-good ECS task definition |
| **Input** | `{ deploymentId, services: { id, previousTaskDefinitionArn }[] }` |
| **Output** | `{ rolledBack: boolean, restoredServices: string[] }` |
| **How** | Calls `ecs.updateService` with `forceNewDeployment: true` using the previous task definition ARN. Runs in parallel across all services |
| **Target SLA** | < 2 minutes to full rollback |
| **Retry** | 5 retries, 5s backoff (rollback must not fail) |

---

## Agent Communication Map

```
GitHub Push
    │
    ▼ (webhook)
apps/api ──────────────► Temporal Cloud
                              │
                    ┌─────────▼─────────┐
                    │  ConflictGuardWF   │
                    │  ┌──────────────┐  │
                    │  │ Code Analyzer│  │──► GitHub API (fetch files)
                    │  │ Conflict Scan│  │──► GitHub API (fetch files)
                    │  │ Lockfile     │  │──► GitHub API (fetch files)
                    │  │ Env Validator│  │──► AWS Secrets Manager (key names only)
                    │  │ GitHub Status│  │──► GitHub API (commit status)
                    │  └──────────────┘  │
                    └─────────────────────┘

User clicks Deploy
    │
    ▼ (tRPC)
apps/api ──────────────► Temporal Cloud
                              │
                    ┌─────────▼─────────┐
                    │    DeployWF        │
                    │  ┌──────────────┐  │
                    │  │ Code Analyzer│  │──► GitHub API
                    │  │ Build Agent  │  │──► AWS CodeBuild + ECR
                    │  │ Provision    │  │──► AWS ECS Fargate
                    │  │ Secret Inject│  │──► AWS Secrets Manager → ECS task
                    │  │ Health Check │  │──► Service HTTP endpoints
                    │  │ Rollback     │  │──► AWS ECS (if needed)
                    │  └──────────────┘  │
                    └─────────────────────┘
                              │
                              ▼ (SSE)
                       apps/web dashboard
                       (real-time logs)
```

---

## Future Agents (Post-MVP)

| Agent | Purpose |
|---|---|
| **AI Conflict Resolver Agent** | Uses Gemini/Claude to suggest resolutions for detected merge conflicts |
| **AI Deploy Advisor Agent** | Analyzes repo and recommends optimal CPU/memory sizing for ECS tasks |
| **Cost Optimizer Agent** | Monitors ECS resource usage and suggests rightsizing |
| **Preview Environment Agent** | Spins up ephemeral environments per PR, tears down on close |
| **Notification Agent** | Sends Slack/email notifications for deploy events |
| **Domain Agent** | Handles custom domain provisioning via Route53 + ACM |
| **BYOC Agent** | Adapts deploy pipeline for user's own AWS account |
