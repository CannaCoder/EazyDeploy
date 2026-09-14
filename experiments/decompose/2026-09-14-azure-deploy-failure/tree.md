# Hypothesis Tree: AZURE Deployment Failure

**Incident**: `2026-09-14-azure-deploy-failure`  
**Target Repo**: `https://github.com/Azure-Samples/azure-voting-app-redis.git`  
**Provider**: `azure`  

```
Deployment Execution Failure
├── [?] Branch / Git Access
│   └── Repo: https://github.com/Azure-Samples/azure-voting-app-redis.git
├── [?] Pre-flight / Conflict Guard
│   └── Lockfile check & syntax AST validation
├── [?] Container Build
│   └── Dockerfile build / ECR or ACR push
├── [?] Infrastructure Provisioning
│   └── Cloud Adapter (azure)
└── [?] Ingress & Health Verification
    └── Probe failed: Deployment workflow transitioned to FAILED status
```
