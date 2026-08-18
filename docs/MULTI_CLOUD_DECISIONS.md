# Shipora — Multi-Cloud Architecture Decisions (Master Reference)

> **Purpose**: Single source of truth for all architectural decisions made during the multi-cloud deployment planning. Reference this before implementing any Phase 3.5 or Phase 6 work.

---

## All Decisions At a Glance

| # | Decision | Chosen Option | Phase |
|---|----------|---------------|-------|
| 1 | Where to store secrets for non-AWS clouds? | Target cloud's native vault (Azure Key Vault, GCP Secret Manager). DO exception: Shipora vault → push at deploy | 3.5 / 6 |
| 2 | How does user provide `.env`? | Auto-detect from `.env.example` + smart paste detection for `KEY=value` pairs + manual upload fallback | 3.5 |
| 3 | Cloud scope for MVP? | AWS + Azure first. DigitalOcean + GCP later | 3.5 → 6 |
| 4 | Deploy architecture? | Provider Adapter Pattern — shared `CloudProviderAdapter` interface, pluggable adapters per cloud | 3.5 |
| 5 | AWS auth method? | CloudFormation one-click → creates scoped IAM role with ExternalId trust policy | 3.5 |
| 6 | Azure auth method? | OAuth 2.0 via Azure AD → auto-create Service Principal with scoped RBAC | 3.5 |
| 7 | DigitalOcean auth method? | OAuth 2.0 → access token (refresh tokens never expire) | 6 |
| 8 | GCP auth method? | Google OAuth 2.0 → auto-create Service Account with scoped IAM roles | 6 |
| 9 | Cloud management level? | Level 2 — Full Infrastructure Lifecycle (create, scale, teardown, monitor, cost tracking) | 3.5 |
| 10 | Credential storage? | AWS Role ARN encrypted in DB; Azure/GCP Service Principal secrets in Shipora's AWS Secrets Manager | 3.5 |
| 11 | Azure token refresh? | Use client credentials flow — initial OAuth creates a Service Principal with long-lived client secret (~1-2 years). Re-prompt on expiry | 3.5 |
| 12 | Cloud connection scope? | Account-level default with per-project override (both supported in `cloud_connections` table) | 3.5 |
| 13 | DO secrets strategy? | Option C — Shipora vault + push decrypted values at deploy time as `type: "SECRET"` to DO App Platform. Security disclaimer in dashboard | 6 |
| 14 | Resource tagging? | All Shipora-created resources tagged with `shipora:managed-by`, `shipora:project-id`, `shipora:service-id`, `shipora:environment` | 3.5 |
| 15 | MVP scope? | **Build the multi-cloud adapter interface now and ship 2 clouds** (AWS + Azure) in Phase 3.5. DigitalOcean + GCP added later in Phase 6 | 3.5 |

---

## Critical Reminders (Don't Forget!)

### 🚀 MVP Scope

- [ ] **Phase 3.5 MVP**: Build the `CloudProviderAdapter` interface AND ship **2 working clouds** (AWS + Azure) — not just the interface, both adapters must be functional and deployable
- [ ] AWS adapter = refactor of existing Phase 3 deploy logic into the adapter interface
- [ ] Azure adapter = new implementation (Container Apps + ACR + Key Vault + Azure Front Door)
- [ ] The adapter interface must be designed with DO and GCP in mind so adding them in Phase 6 is plug-and-play
- [ ] Phase 3.5 is NOT just infrastructure/abstraction work — it must deliver **two fully working cloud deployment targets**

### 🔐 Secrets

- [ ] `.env.example` parser must handle: comments (`# description`), empty values (`KEY=`), quoted values (`KEY="value"`), multi-line values
- [ ] Smart paste detection: if user pastes `KEY=value\nKEY2=value2`, auto-parse into structured form fields
- [ ] Both the auto-detect form AND raw paste/upload must work — auto-detect is the primary UX, paste/upload is the fallback
- [ ] DigitalOcean: **MUST show security disclaimer** in the secrets UI — DO has no encrypted vault
- [ ] Secrets for AWS/Azure/GCP go directly to the target cloud's vault — Shipora never stores them
- [ ] Secrets for DO go to Shipora's AWS Secrets Manager first, pushed to DO at deploy time

### 🔑 Auth Flows

- [ ] AWS: **No OAuth** — must use CloudFormation one-click redirect. User leaves Shipora, creates stack in AWS Console, returns with Role ARN
- [ ] Azure: Register Shipora as an Azure AD App. Needs `AZURE_CLIENT_ID` + `AZURE_CLIENT_SECRET` in our `.env`
- [ ] DigitalOcean: Register OAuth App at DO developer portal. Needs `DO_CLIENT_ID` + `DO_CLIENT_SECRET`
- [ ] GCP: Configure OAuth consent screen in GCP Console. Needs `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET`. Must enable Cloud Run, Artifact Registry, Secret Manager, Cloud Resource Manager APIs
- [ ] GCP has an extra step: after OAuth, user must **select which GCP Project** to connect

### 🏗️ Infrastructure Management (Level 2)

- [ ] Every resource Shipora creates **must be tagged** — never modify untagged resources
- [ ] On project delete → **full teardown** of all tagged resources in the user's cloud
- [ ] AWS IAM policy must include: `application-autoscaling:*`, `cloudwatch:GetMetricData`, `ce:GetCostAndUsage`, `route53:ChangeResourceRecordSets`, `acm:RequestCertificate`
- [ ] Azure RBAC must include: `Monitoring Reader`, `Cost Management Reader`, `DNS Zone Contributor`
- [ ] Dashboard must expose: scaling controls, cost dashboard, metrics graphs, teardown button

### 📦 Provider Adapter Pattern

- [ ] `CloudProviderAdapter` interface methods: `authenticate()`, `buildImage()`, `pushSecrets()`, `provisionService()`, `configureIngress()`, `getDeploymentStatus()`
- [ ] Refactor ALL existing AWS deploy logic into the AWS adapter — don't leave any AWS-specific code in the workflow
- [ ] The `DeployWorkflow` in Temporal must be 100% cloud-agnostic — it only calls adapter methods
- [ ] Adapter is resolved at runtime via `project.cloud_provider` field in the database

### 🗃️ Database

- [ ] New `cloud_connections` table with provider-specific columns (role_arn for AWS, tenant_id/client_id/client_secret for Azure, etc.)
- [ ] `projects` table gets `cloud_provider` column (`aws` | `azure` | `digitalocean` | `gcp`, default `aws`)
- [ ] `cloud_connections.project_id` is **nullable** — `NULL` means account-level connection, non-null means project-level override
- [ ] Track `expires_at` for Azure/GCP credentials — need background job or on-demand check for expiry

### 🗺️ Roadmap Order

- [ ] Phase 3.5: Provider Adapter interface + AWS adapter refactor + Azure adapter + CloudFormation connect + Azure OAuth + Smart .env detection + Cloud connection management UI
- [ ] Phase 6: DigitalOcean adapter + GCP adapter + their OAuth routes + DO secrets strategy + Preview environments + Custom domains + BYOC enhancements + CLI
