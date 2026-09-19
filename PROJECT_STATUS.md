# EazyDeploy — Project Status & Master Checklist

> **Last updated:** 2026-09-20
> **Goal:** Complete the platform to production-readiness (NOT deployment yet — product completion first)
> **Rule:** Only touch the exact file needed. Verify every change twice. No unnecessary code. Act as senior developer at all times on any coding/architecture question.
> **Pipeline Status:** Fully operational. CI (`ci.yml`) & CD (`deploy.yml`) verified green end-to-end on AWS ECS Fargate & ALB.

---

## 🔴 Blockers (security — rotate before doing anything else)

- [x] Rotate Clerk Secret Key (committed in `.env`)
- [x] Rotate GitHub App Private Key (committed in `.env`)
- [x] Rotate AWS Access Key + Secret Key (committed in `.env`)
- [x] Rotate Temporal API Key (committed in `.env`)
- [x] Rotate Azure Client Secret (committed in `.env`)
- [~] Rotate GCP Client Secret (deferred — GCP not needed for current scope)
- [x] Rotate Upstash Redis token (committed in `.env`)
- [x] Add `.env` to `.gitignore`

---

## Phase 1 — CD Pipeline (Current Focus)

> Build a complete, tested Continuous Deployment pipeline. No shortcuts.

- [x] **1.1** Create `.github/workflows/deploy.yml` — build & push all 3 Docker images to ECR on merge to `main`
- [x] **1.2** Add ECS rolling update step (API service, temporal-worker service) after ECR push
- [x] **1.3** Add post-deploy health check verification (hit `/health` on ALB URL)
- [x] **1.4** Add GitHub deployment environment + status reporting (pass/fail visible on PR)
- [x] **1.5** Document all required GitHub Actions secrets that must be set in repo settings
- [x] **1.6** Wire CD to trigger only after CI (`ci.yml`) passes (`workflow_run` on CI success + `workflow_dispatch`)
- [x] **1.7** Test the pipeline end-to-end with a real push — confirm images in ECR and ECS tasks update
- [x] **1.8** Confirm ALB health check passes after deploy

---

## Phase 2 — Remove Debug Scripts with Hardcoded Secrets

> Issue #5 from deployment readiness report — only touches `packages/db/src/`

- [x] **2.1** Move `packages/db/src/vexctx-all-logs.ts` → `scratch/db/`
- [x] **2.2** Move `packages/db/src/diagnose-deployments.ts` → `scratch/db/`
- [x] **2.3** Move `packages/db/src/get-all-deployments.ts` → `scratch/db/`
- [x] **2.4** Move `packages/db/src/get-logs.ts` → `scratch/db/`
- [x] **2.5** Move `packages/db/src/check-vexctx.ts` → `scratch/db/`
- [x] **2.6** Add `scratch/` to `.gitignore`
- [x] **2.7** Verify `packages/db/src/index.ts` exports are unaffected

---

## Phase 3 — UI Refinement (Production-Ready)

> Goal: Remove all draft/placeholder language, make copy and design production-grade.
> Rule: **Zero touches to API, backend, env files, or any non-UI code.**

### Landing Page
- [x] **3.1** Replace version badge `v2.4.0 · Live` with correct/real version or remove
- [x] **3.2** Audit CLI copy command — confirm branding (`shipora` vs `eazydeploy`)
- [x] **3.3** Footer GitHub link points to bare `https://github.com` — update to real repo URL
- [x] **3.4** Verify all nav anchor links resolve (no broken scroll targets)
- [x] **3.5** Audit all marketing copy for placeholder, WIP, or "Vercel-style" imitation language

### Dashboard & Inner Pages
- [x] **3.6** Audit dashboard pages for WIP or placeholder copy
- [x] **3.7** Audit deployments pages
- [x] **3.8** Audit landing interactive simulator for hardcoded fake data
- [x] **3.9** Verify page `<title>` and meta descriptions in `layout.tsx`
- [x] **3.10** Remove any `console.log` debug from UI components

---

## Phase 4 — End-to-End Deployment Test Agent

> Automated agent: paste repo URL → configure envs → trigger deploy → wait → pass (give live URL) or fail (run /decompose, generate fix brief)

- [x] **4.1** Design test agent workflow and assertion checklist
- [x] **4.2** Build the test agent (`scripts/test-deploy-agent.ts`)
- [x] **4.3** Test with AWS cloud connector full flow (Verified post-rotation: `34a3928d-5f54-4230-bbf8-eb3d62ed23c2` → HTTP 200 on live ALB in 432ms)
- [x] **4.4** Test with Azure cloud connector full flow (Verified: `94f2fe78-659b-4ccb-8371-7738583170eb` → HTTP 200 on live Azure Container App)
- [x] **4.5** On pass: smoke-test live URL, report back to user
- [x] **4.6** On fail: run `/decompose`, generate `experiments/decompose/<slug>/handoff.md`
- [x] **4.7** Document agent usage in `README.md`

---

## Phase 5 — Pre-Launch Hardening

- [x] **5.1** Lock CORS to production domain in `apps/api/src/app.ts` (strict hostname validation: `WEB_DASHBOARD_URL`, `shipora.app`, `*.shipora.app`, `CORS_ORIGINS`; hardened against origin suffix spoofing)
- [x] **5.2** Set `NEXT_PUBLIC_API_URL` to production URL (supported build args in `apps/web/Dockerfile`, dynamic Clerk token in `apps/web/src/providers.tsx` with dev fallback)
- [~] **5.3** Update all OAuth redirect URIs to production URLs (deferred till final public domain DNS is bound)
- [x] **5.4** Add E2E Playwright job to CI workflow (`.github/workflows/ci.yml` + verified 3/3 tests pass)
- [~] **5.5** Inject secrets via AWS Secrets Manager (deferred to live cloud ECS task definition provisioning)
- [x] **5.6** Secure `createContext` with Clerk `verifyToken` & restrict `test_user_` tokens to `NODE_ENV !== "production"`
- [x] **5.7** Document `ENCRYPTION_KEY` in `.env.example` & add `db:migrate` / `db:push` scripts to root `package.json`

---

## Tracking Legend

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[/]` | In progress |
| `[x]` | Complete |
| `[~]` | Deferred / blocked |

---

## Notes

- **Brand name in codebase:** `@shipora` — confirm rename to EazyDeploy scope before touching UI copy
- **ECR:** `690990575414.dkr.ecr.eu-north-1.amazonaws.com` (eu-north-1)
- **ECS Cluster:** `arn:aws:ecs:eu-north-1:690990575414:cluster/shipora-cluster`
- **CodeBuild project:** `shipora-container-builder`
- **Apps in scope for CD:** `apps/api`, `apps/web`, `apps/temporal-worker`
