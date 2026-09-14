# Incident Learnings: AZURE Deployment

- **Timestamp**: 2026-09-14T19:56:50.412Z
- **Observed Failure**: Deployment workflow transitioned to FAILED status
- **Last Known Stage**: failed (Step: Auto-rolled back — Health check timed out after 120s)
- **Raw Error Details**:
```json
"Error: Deployment workflow transitioned to FAILED status\n    at runDeploymentTestAgent (/Users/binova/Documents/Projects/Suru/EazyDeploy/scripts/test-deploy-agent.ts:551:7)\n    at process.processTicksAndRejections (node:internal/process/task_queues:103:5)"
```
