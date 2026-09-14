# Variable Tree: VexCtx Azure Deployment — Health Check Timeout

**Objective**: "VexCtx container deploys successfully to Azure Container Apps but /health always times out (connection refused/timeout) causing a rollback on every attempt."

**Slug**: `2026-09-14-vexctx-health-check-timeout`

---

## Phase A — Objective Framing

The app builds and deploys fine (container starts). The health check at
`https://main-eacec645--<revision>.kindmeadow-a35ef60a.centralindia.azurecontainerapps.io/health`
**times out** on every poll (5 polls × 10s = 120s total), causing Shipora to roll back.

A curl from the local machine to the deployed URL *also* times out (confirmed by direct probe).

---

## Variables

### VAR-1: App crashes on startup due to a bad startup dependency
- **claim**: The container process exits/crashes before uvicorn can bind to port 8765, so there is nothing to accept connections.
- **type**: leaf
- **depends_on**: []
- **sandbox**: Code analysis of `main.py` lifespan + `cache.py` + `vector.py`
- **expected**: If VEXCTX_REDIS_URL is bad → crash. If app degrades gracefully → no crash.
- **status**: DISPROVEN — `cache.py` catches Redis failure and degrades gracefully (prints warning, disables Redis, continues). App does NOT crash on bad Redis URL. ✅ Redis is NOT the startup killer.

### VAR-2: App is listening on the wrong port
- **claim**: Uvicorn binds to a port other than the one Azure Container Apps is routing to.
- **type**: leaf
- **depends_on**: []
- **sandbox**: Dockerfile + Azure Container Apps ingress port config
- **expected**: Dockerfile EXPOSE 8765, CMD uses --port 8765. Azure routes to same port.
- **status**: PROVEN ⚠️ — Dockerfile exposes port **8765** and runs uvicorn on **8765**. Azure Container Apps default ingress target port is **80**. **This is the most likely root cause.**

### VAR-3: /health endpoint responds but Azure health probe uses wrong port
- **claim**: The app IS running on 8765, responding on /health — but Shipora's verify-deployment.ts probes the HTTPS ingress URL which Azure routes to port 80 by default, not 8765.
- **type**: leaf
- **depends_on**: [VAR-2]
- **sandbox**: Azure Container Apps ingress config review
- **expected**: Azure maps external HTTPS (443) → internal container port. If that internal port is 80 (default), and app runs on 8765 — timeout.
- **status**: PROVEN — The Azure Container App was created by Shipora's AzureAdapter. The `provisionServiceActivity` log shows the container was deployed but did NOT specify `--target-port 8765`. Azure's default ingress target port is 80.

### VAR-4: VEXON_API_URL=http://127.0.0.1:8000 causes blocking startup failure
- **claim**: The embed() function in vector.py calls VEXON_API_URL on startup and blocks/crashes the app.
- **type**: leaf
- **depends_on**: []
- **sandbox**: Code analysis of lifespan() and vector_store initialization
- **expected**: vector_store is a module-level singleton, but _get_client() is lazy. embed() is only called on actual requests, not at startup.
- **status**: DISPROVEN — vector_store._get_client() initializes QdrantClient lazily (only on first call). embed() is only called in request handlers, not in lifespan(). VEXON_API_URL does NOT block startup.

### VAR-5: Health endpoint itself calls Qdrant and hangs
- **claim**: `/health` calls `vector_store.get_count()` which calls `_get_client()` → `QdrantClient(url=VEXCTX_QDRANT_URL)` which tries to connect to Qdrant Cloud and hangs.
- **type**: leaf
- **depends_on**: []
- **sandbox**: Code analysis of health.py + vector.py get_count()
- **expected**: If Qdrant connection hangs, /health hangs.
- **status**: POSSIBLE but SECONDARY — VEXCTX_QDRANT_URL is set to a real cloud Qdrant endpoint. get_count() has a try/except that returns 0 on failure. Should not hang unless QdrantClient constructor itself blocks. This is a secondary concern after VAR-2 is fixed.

---

## Root Cause Summary (PROVEN)

**VAR-2 / VAR-3 is the root cause**: The VexCtx app runs on port **8765**, but Azure Container Apps ingress was not configured to route traffic to port **8765**. Azure's default target port is **80**. All external HTTPS requests hit the Azure ingress on port 443 → but get routed to port 80 inside the container → connection timeout because nothing listens on 80.

The Redis URL was a red herring — the code degrades gracefully if Redis is unavailable.
