# Handoff Brief: Azure ACR Container Build Timeout

## Verified Facts
1. **Failure Symptom**:
   - Azure deployment `3100041e-dc09-43a5-8def-00e42d095b23` failed at `ACR Container Builds` with `Container build failed for: main`.
   - Worker log recorded: `[AzureAdapter] [build] ❌ Build failed: spawnSync /bin/sh ETIMEDOUT` after exactly 10 minutes (600,000 ms).
2. **Root Cause**:
   - Unlike AWS (which delegates to AWS CodeBuild), `AzureAdapter.buildContainer` (`packages/cloud-adapters/src/azure/index.ts:458`) invokes `docker build --platform linux/amd64` locally via Node `execSync`.
   - On an Apple Silicon (`aarch64`) Mac, building an Alpine `linux/amd64` container forces Docker to use QEMU binary emulation.
   - Next.js 16's Turbopack native Rust binary segfaults under QEMU on Alpine (`qemu: uncaught target signal 11 (Segmentation fault) - core dumped`), causing the process to hang until `execSync` times out.
3. **Azure Cloud Capability**:
   - Azure Container Registry supports cloud-based Docker builds via ACR Tasks / Quick Run API (`listBuildSourceUploadUrl` + `scheduleRun`).

## Recommended Implementation
1. **Option A (Architectural Enhancement — Cloud Native)**:
   - Refactor `AzureAdapter.buildContainer` to use Azure Container Registry Tasks:
     1. Call `POST .../registries/{name}/listBuildSourceUploadUrl` using ARM token.
     2. Create a `.tar.gz` archive of the build context and upload it via `PUT` request with `x-ms-blob-type: BlockBlob`.
     3. Call `POST .../registries/{name}/scheduleRun` with `type: "DockerBuildRequest"`.
     4. Poll run status until `Succeeded`.
2. **Option B (Immediate Local Workaround)**:
   - Enable Rosetta emulation in Docker Desktop (*Settings -> General -> "Use Rosetta for x86/amd64 emulation on Apple Silicon"*).
   - Alternatively, add `--webpack` to `package.json` build script in `Owed` (`next build --webpack`) to avoid Turbopack segfaulting under QEMU.
