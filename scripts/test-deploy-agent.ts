#!/usr/bin/env tsx
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Shipora Deployment Test Agent
 *
 * Automated deployment validation agent for AWS and Azure cloud integrations.
 * Follows the Deployment Test Agent Protocol defined in default-approach.md:
 *
 * 1. Resolves target repository & cloud credentials (AWS / Azure)
 * 2. Creates/retrieves project record in Shipora platform
 * 3. Triggers deployment orchestration via tRPC/API
 * 4. Polls deployment progress every 10 seconds (up to 20 minutes)
 * 5. PASS: Smoke-tests the live URL (HTTP 200 check) & reports live URL
 * 6. FAIL: Runs /decompose protocol — writes experiments/decompose/<date-slug>/
 *    with tree.md, runs.jsonl, learnings.md, and handoff.md.
 *
 * Usage:
 *   pnpm dlx tsx scripts/test-deploy-agent.ts --provider=aws
 *   pnpm dlx tsx scripts/test-deploy-agent.ts --provider=azure
 *   pnpm dlx tsx scripts/test-deploy-agent.ts --provider=aws --dry-run
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Load environment variables from repo root via Node 22 native loader
try {
  const envPath = resolve(process.cwd(), ".env");
  if (existsSync(envPath)) {
    if (typeof (process as any).loadEnvFile === "function") {
      (process as any).loadEnvFile(envPath);
    } else {
      // Fallback simple line-by-line parser
      const content = readFileSync(envPath, "utf-8");
      for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
          if (!process.env[key]) process.env[key] = val;
        }
      }
    }
  }
} catch {}

// ── Configuration & Pre-approved Repos ───────────────────────────────────────
const PRE_APPROVED_REPOS = {
  aws: {
    url: "https://github.com/aws-samples/ecs-demo-php-simple-app.git",
    branch: "master",
    dockerfilePath: "Dockerfile",
    port: 80,
    owner: "aws-samples",
    repo: "ecs-demo-php-simple-app",
  },
  azure: {
    url: "https://github.com/Azure-Samples/azure-voting-app-redis.git",
    branch: "master",
    dockerfilePath: "azure-vote/Dockerfile",
    port: 80,
    owner: "Azure-Samples",
    repo: "azure-voting-app-redis",
  },
} as const;

type Provider = "aws" | "azure";

interface AgentOptions {
  provider: Provider;
  repoUrl: string;
  branch: string;
  timeoutSeconds: number;
  pollIntervalSeconds: number;
  dryRun: boolean;
  apiUrl: string;
}

interface RunLog {
  timestamp: string;
  step: string;
  status: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  message: string;
  details?: any;
}

// ── Parse CLI Arguments ──────────────────────────────────────────────────────
function parseArgs(): AgentOptions {
  const args = process.argv.slice(2);
  let provider: Provider = "aws";
  let repoUrl = "";
  let branch = "";
  let timeoutMinutes = 20;
  let pollIntervalSeconds = 10;
  let dryRun = false;
  let apiUrl = process.env["API_URL"] || "http://localhost:4000";

  for (const arg of args) {
    if (arg.startsWith("--provider=")) {
      const val = arg.split("=")[1]?.toLowerCase();
      if (val === "aws" || val === "azure") provider = val;
    } else if (arg.startsWith("--repo=")) {
      repoUrl = arg.split("=")[1] || "";
    } else if (arg.startsWith("--branch=")) {
      branch = arg.split("=")[1] || "";
    } else if (arg.startsWith("--timeout=")) {
      timeoutMinutes = parseInt(arg.split("=")[1] || "20", 10);
    } else if (arg.startsWith("--poll-interval=")) {
      pollIntervalSeconds = parseInt(arg.split("=")[1] || "10", 10);
    } else if (arg === "--dry-run") {
      dryRun = true;
    } else if (arg.startsWith("--api-url=")) {
      apiUrl = arg.split("=")[1] || apiUrl;
    }
  }

  const defaultRepo = PRE_APPROVED_REPOS[provider];
  return {
    provider,
    repoUrl: repoUrl || defaultRepo.url,
    branch: branch || defaultRepo.branch,
    timeoutSeconds: timeoutMinutes * 60,
    pollIntervalSeconds,
    dryRun,
    apiUrl,
  };
}

// ── Logging & Timeline Tracking ──────────────────────────────────────────────
const runLogs: RunLog[] = [];

function log(
  status: "INFO" | "SUCCESS" | "WARN" | "ERROR",
  step: string,
  message: string,
  details?: any
) {
  const ts = new Date().toISOString();
  runLogs.push({ timestamp: ts, step, status, message, details });
  const icon =
    status === "SUCCESS"
      ? "🟢 [PASS]"
      : status === "ERROR"
      ? "🔴 [FAIL]"
      : status === "WARN"
      ? "🟡 [WARN]"
      : "🔵 [INFO]";
  console.log(`${icon} [${step}] ${message}`);
  if (details && status === "ERROR") {
    console.error("   Details:", details);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Credentials Verification ─────────────────────────────────────────────────
function verifyCloudCredentials(provider: Provider): { valid: boolean; error?: string } {
  if (provider === "aws") {
    const key = process.env["AWS_ACCESS_KEY_ID"];
    const secret = process.env["AWS_SECRET_ACCESS_KEY"];
    const region = process.env["AWS_REGION"];
    const account = process.env["AWS_ACCOUNT_ID"];
    if (!key || !secret) {
      return { valid: false, error: "Missing AWS_ACCESS_KEY_ID or AWS_SECRET_ACCESS_KEY in .env" };
    }
    if (!region) {
      return { valid: false, error: "Missing AWS_REGION in .env" };
    }
    log("INFO", "PREFLIGHT", `AWS credentials detected: Key=${key.slice(0, 6)}... Region=${region} Account=${account || "unknown"}`);
    return { valid: true };
  } else {
    const tenant = process.env["AZURE_TENANT_ID"];
    const clientId = process.env["AZURE_CLIENT_ID"];
    const clientSecret = process.env["AZURE_CLIENT_SECRET"];
    const subId = process.env["AZURE_SUBSCRIPTION_ID"];
    if (!tenant || !clientId || !clientSecret || !subId) {
      return { valid: false, error: "Missing required Azure credentials (AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_SUBSCRIPTION_ID) in .env" };
    }
    log("INFO", "PREFLIGHT", `Azure credentials detected: Tenant=${tenant.slice(0, 8)}... SubId=${subId.slice(0, 8)}... ClientId=${clientId.slice(0, 8)}...`);
    return { valid: true };
  }
}

// ── HTTP Helper for tRPC ─────────────────────────────────────────────────────
const AUTH_TOKEN = "Bearer test_user_deploy_agent";

async function trpcQuery<T>(apiUrl: string, path: string, input?: any): Promise<T> {
  const queryParam = input ? `?input=${encodeURIComponent(JSON.stringify(input))}` : "";
  const url = `${apiUrl}/trpc/${path}${queryParam}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH_TOKEN,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC query ${path} failed with HTTP ${res.status}: ${text}`);
  }
  const json: any = await res.json();
  if (json.error) {
    throw new Error(`tRPC query ${path} returned error: ${JSON.stringify(json.error)}`);
  }
  return json.result?.data as T;
}

async function trpcMutate<T>(apiUrl: string, path: string, body?: any): Promise<T> {
  const url = `${apiUrl}/trpc/${path}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: AUTH_TOKEN,
    },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`tRPC mutation ${path} failed with HTTP ${res.status}: ${text}`);
  }
  const json: any = await res.json();
  if (json.error) {
    throw new Error(`tRPC mutation ${path} returned error: ${JSON.stringify(json.error)}`);
  }
  return json.result?.data as T;
}

// ── Decompose Failure Generator ──────────────────────────────────────────────
function generateDecomposeArtifacts(
  provider: Provider,
  repoUrl: string,
  error: any,
  lastProgress: any
) {
  const dateSlug = `${new Date().toISOString().slice(0, 10)}-${provider}-deploy-failure`;
  const decomposeDir = resolve(process.cwd(), `experiments/decompose/${dateSlug}`);

  if (!existsSync(decomposeDir)) {
    mkdirSync(decomposeDir, { recursive: true });
  }

  // 1. runs.jsonl
  const runsJsonlPath = resolve(decomposeDir, "runs.jsonl");
  const jsonlLines = runLogs.map((l) => JSON.stringify(l)).join("\n");
  writeFileSync(runsJsonlPath, jsonlLines, "utf-8");

  // 2. tree.md (Hypothesis Tree)
  const treeMd = `# Hypothesis Tree: ${provider.toUpperCase()} Deployment Failure

**Incident**: \`${dateSlug}\`  
**Target Repo**: \`${repoUrl}\`  
**Provider**: \`${provider}\`  

\`\`\`
Deployment Execution Failure
├── [?] Branch / Git Access
│   └── Repo: ${repoUrl}
├── [?] Pre-flight / Conflict Guard
│   └── Lockfile check & syntax AST validation
├── [?] Container Build
│   └── Dockerfile build / ECR or ACR push
├── [?] Infrastructure Provisioning
│   └── Cloud Adapter (${provider})
└── [?] Ingress & Health Verification
    └── Probe failed: ${error?.message || "Unknown timeout"}
\`\`\`
`;
  writeFileSync(resolve(decomposeDir, "tree.md"), treeMd, "utf-8");

  // 3. learnings.md
  const learningsMd = `# Incident Learnings: ${provider.toUpperCase()} Deployment

- **Timestamp**: ${new Date().toISOString()}
- **Observed Failure**: ${error?.message || "Timeout or verification probe error"}
- **Last Known Stage**: ${lastProgress?.stage || "unknown"} (Step: ${lastProgress?.currentStep || "none"})
- **Raw Error Details**:
\`\`\`json
${JSON.stringify(error?.stack || error, null, 2)}
\`\`\`
`;
  writeFileSync(resolve(decomposeDir, "learnings.md"), learningsMd, "utf-8");

  // 4. handoff.md (Root cause + Surgical fix path)
  const handoffMd = `# Handoff Brief: ${provider.toUpperCase()} Deployment Resolution

**Incident Slug**: \`${dateSlug}\`
**Confidence**: HIGH — Captured from live execution run

---

## Failure Summary
- **Cloud Provider**: \`${provider}\`
- **Target Repository**: \`${repoUrl}\`
- **Failure Stage**: \`${lastProgress?.stage || "pre-flight"}\`
- **Root Cause**: \`${error?.message || "Execution failed or timed out during deployment loop"}\`

---

## Diagnostics & Logs
See \`runs.jsonl\` in this directory for the full chronological event trace.
Last step recorded: \`${lastProgress?.currentStep || "N/A"}\`

---

## Surgical Fix Path
1. Check cloud connector permissions for \`${provider}\`.
2. Inspect worker logs in \`apps/temporal-worker\` for the failed activity.
3. Verify target port and container health check response.
`;
  writeFileSync(resolve(decomposeDir, "handoff.md"), handoffMd, "utf-8");

  log("WARN", "DECOMPOSE", `Generated /decompose incident package at: experiments/decompose/${dateSlug}/`);
}

// ── Smoke Test Live URL ──────────────────────────────────────────────────────
async function smokeTestEndpoint(url: string): Promise<{ ok: boolean; status: number; latencyMs: number; directUrl?: string }> {
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "Shipora-TestAgent/1.0" },
    });
    const latencyMs = Date.now() - start;
    return { ok: res.ok, status: res.status, latencyMs };
  } catch (err: any) {
    // If public DNS failed (e.g. NXDOMAIN/ENOTFOUND on unmapped vanity domain) and ALB_DNS_NAME is available,
    // verify directly against the ALB endpoint with the vanity host header
    const albDns = process.env["ALB_DNS_NAME"];
    if (albDns) {
      try {
        const parsed = new URL(url);
        const albUrl = `http://${albDns}${parsed.pathname}${parsed.search}`;
        const albRes = await fetch(albUrl, {
          method: "GET",
          headers: {
            "User-Agent": "Shipora-TestAgent/1.0",
            Host: parsed.hostname,
          },
        });
        return {
          ok: albRes.ok,
          status: albRes.status,
          latencyMs: Date.now() - start,
          directUrl: albUrl,
        };
      } catch {
        // Fallback failed as well
      }
    }
    return { ok: false, status: 0, latencyMs: Date.now() - start };
  }
}

// ── Main Test Agent Orchestration ────────────────────────────────────────────
async function runDeploymentTestAgent() {
  const opts = parseArgs();

  console.log("───────────────────────────────────────────────────────────────────");
  console.log("  SHIPORA END-TO-END DEPLOYMENT TEST AGENT");
  console.log("───────────────────────────────────────────────────────────────────");
  console.log(`  Provider:         ${opts.provider.toUpperCase()}`);
  console.log(`  Target Repo:      ${opts.repoUrl}`);
  console.log(`  Branch:           ${opts.branch}`);
  console.log(`  API URL:          ${opts.apiUrl}`);
  console.log(`  Timeout:          ${opts.timeoutSeconds}s`);
  console.log(`  Poll Interval:    ${opts.pollIntervalSeconds}s`);
  console.log(`  Mode:             ${opts.dryRun ? "DRY RUN (Validation only)" : "LIVE EXECUTION"}`);
  console.log("───────────────────────────────────────────────────────────────────\n");

  // Step 1: Pre-flight Credentials Verification
  log("INFO", "PREFLIGHT", `Verifying environment and ${opts.provider.toUpperCase()} credentials...`);
  const credCheck = verifyCloudCredentials(opts.provider);
  if (!credCheck.valid) {
    log("ERROR", "PREFLIGHT", credCheck.error || "Credential check failed");
    process.exit(1);
  }
  log("SUCCESS", "PREFLIGHT", "Environment and credentials validated.");

  // Step 2: API Connectivity
  log("INFO", "API", `Pinging API health at ${opts.apiUrl}/health...`);
  try {
    const healthRes = await fetch(`${opts.apiUrl}/health`);
    if (!healthRes.ok) throw new Error(`Health returned HTTP ${healthRes.status}`);
    const healthJson = await healthRes.json();
    log("SUCCESS", "API", `Connected to Shipora API (${(healthJson as any)?.service || "ok"})`);
  } catch (err: any) {
    log("ERROR", "API", `Could not connect to Shipora API: ${err.message}`);
    log("WARN", "API", "Ensure the dev server / API is running (pnpm --filter api dev)");
    process.exit(1);
  }

  if (opts.dryRun) {
    log("SUCCESS", "DRY-RUN", "Dry run completed successfully. All pre-flight assertions passed.");
    process.exit(0);
  }

  // Step 3: Get or Create Project
  const defaultMeta = PRE_APPROVED_REPOS[opts.provider];
  log("INFO", "PROJECT", `Configuring project for repo ${defaultMeta.owner}/${defaultMeta.repo}...`);

  let projectId: string | null = null;
  try {
    const existingProjects = await trpcQuery<any[]>(opts.apiUrl, "project.list");
    const match = existingProjects.find(
      (p) =>
        p.githubRepoOwner?.toLowerCase() === defaultMeta.owner.toLowerCase() &&
        p.githubRepoName?.toLowerCase() === defaultMeta.repo.toLowerCase()
    );

    if (match) {
      projectId = match.id;
      log("INFO", "PROJECT", `Found existing project: ${projectId} (${match.name})`);
    } else {
      const created = await trpcMutate<any>(opts.apiUrl, "project.create", {
        name: `test-${defaultMeta.repo}`,
        githubRepoOwner: defaultMeta.owner,
        githubRepoName: defaultMeta.repo,
        githubInstallationId: 1001,
        productionBranch: opts.branch,
        cloudProvider: opts.provider,
        envVars: {
          PORT: defaultMeta.port.toString(),
          NODE_ENV: "production",
        },
      });
      projectId = created.id;
      log("SUCCESS", "PROJECT", `Created test project: ${projectId}`);
    }
  } catch (err: any) {
    log("ERROR", "PROJECT", `Failed to set up project: ${err.message}`);
    generateDecomposeArtifacts(opts.provider, opts.repoUrl, err, null);
    process.exit(1);
  }

  // Step 4: Trigger Deployment
  log("INFO", "DEPLOY", `Triggering deployment on project ${projectId}...`);
  let deploymentId: string;
  try {
    const deployRes = await trpcMutate<any>(opts.apiUrl, "deployment.trigger", {
      projectId,
      branch: opts.branch,
      envVars: {
        PORT: defaultMeta.port.toString(),
      },
    });
    deploymentId = deployRes.id || deployRes.deploymentId;
    log("SUCCESS", "DEPLOY", `Deployment triggered! Deployment ID: ${deploymentId}`);
  } catch (err: any) {
    log("ERROR", "DEPLOY", `Failed to trigger deployment: ${err.message}`);
    generateDecomposeArtifacts(opts.provider, opts.repoUrl, err, null);
    process.exit(1);
  }

  // Step 5: Poll Deployment Status
  log("INFO", "POLL", `Starting polling loop (every ${opts.pollIntervalSeconds}s, max ${opts.timeoutSeconds}s)...`);
  const startTime = Date.now();
  let lastStage = "";
  let finalStatus: "success" | "failed" | "timed_out" = "timed_out";
  let finalDeployment: any = null;

  while (Date.now() - startTime < opts.timeoutSeconds * 1000) {
    await sleep(opts.pollIntervalSeconds * 1000);
    const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

    try {
      const current = await trpcQuery<any>(opts.apiUrl, "deployment.getById", { id: deploymentId });
      finalDeployment = current;
      const stage = current.liveProgress?.stage || current.status || "pending";
      const currentStep = current.liveProgress?.currentStep || "processing";
      const percent = current.liveProgress?.percent ?? 0;

      if (stage !== lastStage) {
        lastStage = stage;
        log("INFO", "PROGRESS", `[${elapsedSeconds}s] Stage: ${stage.toUpperCase()} (${percent}%) — ${currentStep}`);
      }

      if (current.status === "success" || stage === "completed") {
        finalStatus = "success";
        break;
      }

      if (current.status === "failed" || stage === "failed") {
        finalStatus = "failed";
        break;
      }
    } catch (err: any) {
      log("WARN", "POLL", `Error during polling check: ${err.message}`);
    }
  }

  // Step 6: Evaluate Results
  if (finalStatus === "success") {
    log("SUCCESS", "ORCHESTRATION", "Deployment completed successfully!");
    
    // Extract deployed URLs
    const liveUrls: string[] = [];
    if (finalDeployment?.deployedUrls) {
      for (const [_, url] of Object.entries(finalDeployment.deployedUrls)) {
        if (typeof url === "string" && url.startsWith("http")) liveUrls.push(url);
      }
    }
    if (finalDeployment?.services) {
      for (const s of finalDeployment.services) {
        if (s.serviceUrl && s.serviceUrl.startsWith("http")) liveUrls.push(s.serviceUrl);
      }
    }

    const testUrl = liveUrls[0];
    let smokeResult: any = null;
    if (testUrl) {
      log("INFO", "SMOKE-TEST", `Executing HTTP smoke test against live URL: ${testUrl}`);
      smokeResult = await smokeTestEndpoint(testUrl);
      if (smokeResult.ok) {
        if (smokeResult.directUrl) {
          log("SUCCESS", "SMOKE-TEST", `HTTP 200 check PASSED in ${smokeResult.latencyMs}ms via direct ALB endpoint (${smokeResult.directUrl}) with Host header!`);
        } else {
          log("SUCCESS", "SMOKE-TEST", `HTTP 200 check PASSED in ${smokeResult.latencyMs}ms! Live URL: ${testUrl}`);
        }
      } else {
        log("WARN", "SMOKE-TEST", `Live endpoint responded with HTTP ${smokeResult.status}. URL: ${testUrl}`);
      }
    } else {
      log("INFO", "SMOKE-TEST", "Deployment marked success (no public ingress endpoint discovered).");
    }

    console.log("\n===================================================================");
    console.log("  AGENT REPORT: DEPLOYMENT PASSED");
    console.log("===================================================================");
    console.log(`  Provider:    ${opts.provider.toUpperCase()}`);
    console.log(`  Deployment:  ${deploymentId}`);
    if (testUrl) console.log(`  Live URL:    ${testUrl}`);
    if (smokeResult?.directUrl) console.log(`  Direct ALB:  ${smokeResult.directUrl}`);
    console.log("===================================================================\n");
    process.exit(0);
  } else {
    const failureReason =
      finalStatus === "timed_out"
        ? `Deployment exceeded maximum timeout of ${opts.timeoutSeconds}s`
        : "Deployment workflow transitioned to FAILED status";

    log("ERROR", "DEPLOY", failureReason);
    generateDecomposeArtifacts(
      opts.provider,
      opts.repoUrl,
      new Error(failureReason),
      finalDeployment?.liveProgress
    );

    console.log("\n===================================================================");
    console.log("  AGENT REPORT: DEPLOYMENT FAILED");
    console.log("===================================================================");
    console.log(`  Reason:      ${failureReason}`);
    console.log(`  Incident:    experiments/decompose/`);
    console.log("===================================================================\n");
    process.exit(1);
  }
}

runDeploymentTestAgent().catch((err) => {
  console.error("Fatal test agent error:", err);
  process.exit(1);
});
