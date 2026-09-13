# Learnings: Azure ACR Container Build Timeout

## Summary of Findings

1. **Host-Side Execution in Azure Adapter vs Cloud Execution in AWS**:
   - In AWS, container builds are dispatched to **AWS CodeBuild** (`StartBuildCommand`), running in AWS cloud on native x86_64 runners.
   - In Azure, `AzureAdapter.buildContainer` (`packages/cloud-adapters/src/azure/index.ts:458`) runs `execSync("docker build --platform linux/amd64 ...")` locally on the host machine running the Temporal worker.

2. **Apple Silicon QEMU Emulation Crash with Turbopack**:
   - The host is an Apple Silicon Mac (`ARM64`).
   - Building for target `--platform linux/amd64` invokes Docker Desktop's QEMU emulation layer.
   - In Next.js 16 (`owed`), `next build` defaults to **Turbopack**.
   - Under QEMU on Alpine Linux (`node:20-alpine`), the native Turbopack Rust compiler crashes with:
     ```
     qemu: uncaught target signal 11 (Segmentation fault) - core dumped
     ```
   - Because QEMU traps the signal without exiting, the process hangs indefinitely.
   - After 10 minutes (`timeout: 600000`), Node.js `execSync` aborts the hung process with `spawnSync /bin/sh ETIMEDOUT`, failing deployment `3100041e-dc09-43a5-8def-00e42d095b23` at the **"ACR Container Builds"** step.

3. **Solutions**:
   - **Primary Architectural Fix**: Implement true remote cloud builds in `AzureAdapter` using **Azure Container Registry Tasks / Quick Run** (`scheduleRun` / `listBuildSourceUploadUrl`). Source tarballs are uploaded to Azure and built directly in Azure's cloud on native x86_64 runners, eliminating all host Docker dependencies and CPU emulation bottlenecks.
   - **Immediate Local Workaround**: Enable Rosetta 2 emulation in Docker Desktop on macOS (*Settings -> General -> "Use Rosetta for x86/amd64 emulation on Apple Silicon"*), or pass `--webpack` to `next build` to avoid the Turbopack musl segfault under QEMU.
