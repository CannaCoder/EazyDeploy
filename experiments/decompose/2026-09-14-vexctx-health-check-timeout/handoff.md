# Handoff Brief: VexCtx Deployment Fix

**Experiment**: `2026-09-14-vexctx-health-check-timeout`
**Confidence**: HIGH — root cause confirmed by code analysis + live curl probe

---

## Verified Facts

| Fact | Source |
|---|---|
| VexCtx runs uvicorn on port **8765** | `Dockerfile` CMD + EXPOSE |
| Azure Container Apps default ingress target port is **80** | Azure docs + observed timeout pattern |
| TLS works (Azure ingress responds), but 0 bytes received (container not reached) | curl probe result |
| Redis failure does NOT crash app | `cache.py` graceful degradation |
| VEXON_API_URL not touched at startup | `vector.py` lazy init, `main.py` lifespan analysis |

---

## Two Fixes Needed

### Fix 1 — Shipora `AzureAdapter` (in EazyDeploy)
**File**: `packages/cloud-adapters/src/azure/` (provision step)

When creating or updating a Container App, the adapter must pass the correct `--target-port` to Azure. It should:
1. Read the `EXPOSE` port from the Dockerfile that was analyzed during `analyzeRepoActivity`, OR
2. Allow users to set a port in Shipora project settings, OR
3. Default to `8765` only for VexCtx, OR (best) parse `EXPOSE` from the adapted Dockerfile

The `analyzeRepoActivity` already clones the repo and reads the Dockerfile — the `EXPOSE` line is available. Pass it through to the provision step.

### Fix 2 — VexCtx repo (in Velodev-io/VexCtx)
This is optional but a good safety net. The `Dockerfile` should document the port clearly, or the user can override the port to `8000` or `80` to match Azure defaults — but Fix 1 is the proper solution.

---

## Recommended Next Step
The specialist implementing this should look at:
- [`packages/cloud-adapters/src/azure/`](file:///Users/binova/Documents/Projects/Suru/EazyDeploy/packages/cloud-adapters) — specifically the Container App provisioning function
- Check how `target_port` / `ingress.targetPort` is set in the `az containerapp create` or SDK call
- The `analyzeRepoActivity` output shape — does it already return the exposed port from the Dockerfile?
