# Learnings: Deployment Status & Health Check Failure

## Summary of Findings

1. **The Fix Worked — Latest Deployment Succeeded**:
   - Deployment `1dddc675-ec29-4491-8377-6479fcf7daa3` ran from `19:41:46 UTC` to `19:45:50 UTC` (01:11 to 01:15 AM local time).
   - Status: `success` (rollbackReason: null).
   - Container Task Definition: `arn:aws:ecs:eu-north-1:690990575414:task-definition/shipora-main:5`.
   - AWS ECS Running Tasks: `1/1` (`main:RUNNING`).
   - AWS ALB Target Health: State is **`healthy`** (`TargetId: 10.0.1.240:3000`).
   - Live URL: `https://main-owed.shipora.app`.

2. **The User's Screen is Showing the Old Failed Deployment**:
   - In the user's screenshot, the browser address bar is on:
     `http://localhost:3000/dashboard/projects/94a8836c-8e60-46a4-b39a-a80579847849/deployments/e3ecc73c-9a5f-491b-93be-785a3f3d7709`
   - Notice the ID `e3ecc73c-9a5f-491b-93be-785a3f3d7709`: this is the specific page for the failed run from 00:43:10.
   - When viewing that URL, it will permanently display "Deploy #47ba427 Deploy Failed" because it is the historical permalink for that failed run.
   - To view the successful deployment, open:
     `http://localhost:3000/dashboard/projects/94a8836c-8e60-46a4-b39a-a80579847849/deployments/1dddc675-ec29-4491-8377-6479fcf7daa3`
     or click **All Deployments** in the UI.

3. **Orphaned Process On Port 3000**:
   - Stale process PID 61380 was occupying port 3000, forcing the new Next.js app to run on port 3001.
   - We terminated the orphaned processes and restarted `pnpm dev`. Port 3000 (web) and port 4000 (api) are now cleanly running the latest server code.
