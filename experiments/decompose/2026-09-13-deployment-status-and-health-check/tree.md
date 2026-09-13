# Variable Tree: Deployment Status & Health Check Failure

**Objective**: "Determine whether the deployment actually failed or whether the user's browser is viewing a stale deployment record / port conflict"

## Variables

### VAR-1: Latest Deployment Execution Status in Database
- **claim**: The latest deployment triggered for project `94a8836c-8e60-46a4-b39a-a80579847849` succeeded.
- **type**: leaf
- **depends_on**: []
- **sandbox**: pnpm db query
- **expected**: Deployment record exists with `status: 'success'` and `rollbackReason: null`.
- **status**: PROVEN

### VAR-2: Browser URL vs Latest Deployment ID
- **claim**: The user's browser URL `/deployments/e3ecc73c-9a5f-491b-93be-785a3f3d7709` is pointing to the historical record of the 00:43:10 failed run, rather than the latest deployment `1dddc675-ec29-4491-8377-6479fcf7daa3`.
- **type**: leaf
- **depends_on**: [VAR-1]
- **sandbox**: string comparison of deployment IDs
- **expected**: The browser URL contains `e3ecc73c-9a5f-491b-93be-785a3f3d7709` (old run), not `1dddc675-ec29-4491-8377-6479fcf7daa3` (new run).
- **status**: PROVEN

### VAR-3: Local Dev Server Port & Orphaned Process Conflict
- **claim**: An orphaned `next dev` process from a previous run is holding port 3000, forcing the updated web frontend onto port 3001 and serving stale UI state on port 3000.
- **type**: leaf
- **depends_on**: []
- **sandbox**: lsof -i :3000 -i :3001
- **expected**: PID 61380 is listening on 3000, while the current dev server web app is running on 3001.
- **status**: PROVEN

### VAR-4: AWS ECS Service & Task Health State
- **claim**: The ECS Fargate service `shipora-main-svc` is actively running on AWS with `runningCount === 1` and `desiredCount === 1` with `assignPublicIp: ENABLED`.
- **type**: leaf
- **depends_on**: []
- **sandbox**: AWS ECS DescribeServices
- **expected**: `shipora-main-svc` has status ACTIVE and runningCount 1.
- **status**: PROVEN

### VAR-6: Next.js Client-Side Supabase Hydration Crash
- **claim**: Next.js client bundle statically baked undefined for NEXT_PUBLIC_SUPABASE_URL during Docker build because Dockerfile lacked build ARGs, causing @supabase/ssr to throw during hydration and rendering "This page couldn't load".
- **type**: leaf
- **depends_on**: []
- **sandbox**: curl JS bundle inspection + browser analysis
- **expected**: lib/supabase/client.ts throws "@supabase/ssr: Your project's URL and API key are required to create a Supabase client!".
- **status**: PROVEN

