# Variable Tree: Azure ACR Container Build Timeout

**Objective**: "Azure container build fails with `spawnSync /bin/sh ETIMEDOUT` after 10 minutes when deploying Owed to Azure ACR."

## Variables

### VAR-1: Build Execution Location & Mechanism
- **claim**: `AzureAdapter.buildContainer` attempts to build the Docker container locally on the host machine using `execSync("docker build --platform linux/amd64 ...")` rather than offloading to Azure cloud builders (like AWS CodeBuild does for AWS).
- **type**: leaf
- **depends_on**: []
- **sandbox**: Code inspection of `packages/cloud-adapters/src/azure/index.ts`
- **expected**: `execSync` is invoked with `docker build --platform linux/amd64` and a 600,000ms (10 min) timeout.
- **status**: PROVEN

### VAR-2: Local Architecture Mismatch & Emulation Crash
- **claim**: Executing `docker build --platform linux/amd64` on Apple Silicon (`aarch64`) fails or hangs because Turbopack's native binary under QEMU on Alpine Linux crashes with `qemu: uncaught target signal 11 (Segmentation fault) - core dumped`.
- **type**: leaf
- **depends_on**: [VAR-1]
- **sandbox**: Local Docker build execution with `--platform linux/amd64` on `Owed/Dockerfile`
- **expected**: Next.js build logs produce QEMU target signal 11 segfault and freezes.
- **status**: PROVEN

### VAR-3: Azure Native Cloud Build Capability (ACR Tasks / Quick Run)
- **claim**: Azure Container Registry supports remote cloud builds via ACR Tasks / Quick Run API (`scheduleRun` / `getBuildSourceUploadUrl`), which compiles natively on Azure cloud without requiring a local Docker daemon or architecture emulation.
- **type**: leaf
- **depends_on**: []
- **sandbox**: Azure REST API & SDK capability check
- **expected**: ACR provides cloud build API accepting source context or git repo.
- **status**: PROVEN

### VAR-4: Emulation Workaround Feasibility (Webpack vs Turbopack)
- **claim**: Bypassing Turbopack (`next build --webpack`) or using glibc avoids the musl/QEMU segfault when building x86_64 on Apple Silicon.
- **type**: leaf
- **depends_on**: [VAR-2]
- **sandbox**: Test build execution
- **expected**: Next.js compiles without QEMU signal 11 segfault.
- **status**: PROVEN
