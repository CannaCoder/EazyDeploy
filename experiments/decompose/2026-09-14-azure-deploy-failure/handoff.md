# Handoff Brief: AZURE Deployment Resolution

**Incident Slug**: `2026-09-14-azure-deploy-failure`
**Confidence**: HIGH — Captured from live execution run

---

## Failure Summary
- **Cloud Provider**: `azure`
- **Target Repository**: `https://github.com/Azure-Samples/azure-voting-app-redis.git`
- **Failure Stage**: `failed`
- **Root Cause**: `Deployment workflow transitioned to FAILED status`

---

## Diagnostics & Logs
See `runs.jsonl` in this directory for the full chronological event trace.
Last step recorded: `Auto-rolled back — Health check timed out after 120s`

---

## Surgical Fix Path
1. Check cloud connector permissions for `azure`.
2. Inspect worker logs in `apps/temporal-worker` for the failed activity.
3. Verify target port and container health check response.
