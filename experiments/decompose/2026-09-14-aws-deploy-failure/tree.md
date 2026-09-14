# Hypothesis Tree: AWS Deployment Failure

**Incident**: `2026-09-14-aws-deploy-failure`  
**Target Repo**: `https://github.com/aws-samples/ecs-demo-php-simple-app.git`  
**Provider**: `aws`  

```
Deployment Execution Failure
├── [?] Branch / Git Access
│   └── Repo: https://github.com/aws-samples/ecs-demo-php-simple-app.git
├── [?] Pre-flight / Conflict Guard
│   └── Lockfile check & syntax AST validation
├── [?] Container Build
│   └── Dockerfile build / ECR or ACR push
├── [?] Infrastructure Provisioning
│   └── Cloud Adapter (aws)
└── [?] Ingress & Health Verification
    └── Probe failed: Deployment exceeded maximum timeout of 1200s
```
