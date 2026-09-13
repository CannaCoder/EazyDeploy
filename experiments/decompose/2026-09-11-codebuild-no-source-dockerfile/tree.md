# Variable Tree: CodeBuild container build fails — "no such file or directory: Dockerfile"

**Objective**: "AWS CodeBuild `docker build` fails when deploying the `web` service because the Dockerfile is not present in the build environment."

**Slug**: `2026-09-11-codebuild-no-source-dockerfile`

---

## Root Failure (OBSERVED)
```
ERROR: failed to build: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
Source Type: NO_SOURCE
```

CodeBuild runs with NO_SOURCE — no git repo is cloned into the build environment. The buildspec tries to run `docker build -f Dockerfile .`, but the working directory is empty.

---

## Variables

### VAR-1: Why is CodeBuild source type NO_SOURCE?
- type: leaf
- depends_on: []
- status: PROVEN-FAIL — CodeBuild project defined in codebuild-stack.ts has NO source configured. AWS defaults to NO_SOURCE.

### VAR-2: Where should the source code come from?
- type: composite
- depends_on: [VAR-1]
- status: PROVEN-FAIL — StartBuildCommand in both build-container.ts and AwsAdapter.buildImage() does NOT pass sourceTypeOverride, sourceVersion, or sourceLocationOverride.

### VAR-3: Does the repo have a Dockerfile for the web service?
- type: leaf
- depends_on: []
- status: PENDING

### VAR-4: Does the activity pass credentials to CodeBuild to clone the repo?
- type: leaf
- depends_on: [VAR-2]
- status: PROVEN-FAIL — No sourceTypeOverride, sourceLocationOverride, or auth passed.

### VAR-5: What is the intended fix path?
- type: composite
- depends_on: [VAR-1, VAR-2, VAR-3, VAR-4]
- status: PENDING
