import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter api dev",
      url: "http://localhost:4000/health",
      reuseExistingServer: !process.env["CI"],
      timeout: 30000,
    },
    {
      command: "pnpm --filter web dev",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env["CI"],
      timeout: 30000,
    },
  ],
});
