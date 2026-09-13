# Learnings: CodeBuild NO_SOURCE — Dockerfile missing

## Root Cause (CONFIRMED)
AWS CodeBuild project `shipora-container-builder` is configured with **NO_SOURCE** (no git source).
When CodeBuild runs, the working directory is empty — there is no repository, no Dockerfile.
The buildspec runs `docker build -f Dockerfile .` against an empty directory → fails.

## Evidence
- `Source Type: NO_SOURCE` in build details
- Log: `ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory`
- CDK `codebuild-stack.ts` has no `source:` property on the Project → AWS defaults to NO_SOURCE

## What needs to happen
CodeBuild needs access to the source code (the git repo) at build time. There are two correct paths:

### Option A (recommended — per-build source override)
When calling `StartBuildCommand`, pass:
- `sourceTypeOverride: "GITHUB"`
- `sourceLocationOverride: "https://github.com/{owner}/{repo}"`
- `sourceVersion: commitSha`
- GitHub credentials via CodeBuild OAuth or a GitHub token stored in Secrets Manager

This is flexible — no change to the CDK stack, credentials pulled per-build from the GitHub App token.

### Option B — configure source at project level in CDK
Add a `source` property to `ShiporaCodeBuildProject` in `codebuild-stack.ts`:
```ts
source: codebuild.Source.gitHub({ owner: "...", repo: "...", webhook: false })
```
Then pass `sourceVersion: commitSha` per build.
Limitation: Only one repo per project — won't work for multi-tenant deployments.

## Additional Findings
- `web` service Dockerfile exists at `apps/web/Dockerfile` ✅
- `api` and `temporal-worker` also have Dockerfiles ✅
- GitHub App + PAT + private key are all configured in `.env` ✅
- `getInstallationOctokit(installationId)` is available in `@shipora/github-app` to generate per-install tokens ✅
- The `installationId` is already passed through the workflow → activity → StartBuild input ✅

## Fix Required (Option A)
In `AwsAdapter.buildImage()` and `buildContainerActivity()`, pass these additional params to `StartBuildCommand`:
1. `sourceTypeOverride: "GITHUB"` 
2. `sourceLocationOverride: "https://github.com/{repoOwner}/{repoName}"`
3. `sourceVersion: input.commitSha`
4. Store a GitHub PAT or use CodeBuild's GitHub OAuth credential in Secrets Manager for cloning

The CodeBuild project also needs GitHub credentials configured once (via AWS Console → CodeBuild → Source credentials).
