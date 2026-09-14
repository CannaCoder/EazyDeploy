# Learnings: VexCtx Health Check Timeout

## Verified Root Cause

**The VexCtx app listens on port 8765 but Azure Container Apps routes external traffic to port 80 by default.**

### Evidence Trail
1. `Dockerfile` line 17: `EXPOSE 8765`
2. `Dockerfile` line 20: `CMD ["uv", "run", "uvicorn", "vexctx.main:app", "--host", "0.0.0.0", "--port", "8765"]`
3. Azure Container Apps: external HTTPS (443) → internal container port. If no `--target-port` is set during provisioning, Azure defaults to **80**.
4. Direct curl to the deployed URL: TLS handshake succeeds (Azure ingress works), but **0 bytes received → timeout** — meaning requests reach the Azure load balancer but never reach the Python process.

### What was ruled out
- ❌ Redis URL (`127.0.0.1:6379`) — `cache.py` catches failures gracefully, app continues running without Redis. NOT the cause of startup crash.
- ❌ VEXON_API_URL — only used in `embed()` which is called lazily on API requests, never on startup.
- ❌ Qdrant connection at health check — has `try/except`, returns 0 on failure, does not hang.

## Fix Required

In Shipora's `AzureAdapter` provisioning code, when deploying a Container App, the `--target-port` must be set to the port the app actually listens on (read from `EXPOSE` in the Dockerfile, or a config field in the project).

**Specifically:** The `provisionServiceActivity` call to Azure Container Apps needs to pass `target_port=8765` (or dynamically detect the `EXPOSE` port from the Dockerfile).
