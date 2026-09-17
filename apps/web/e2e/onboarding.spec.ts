import { test, expect } from "@playwright/test";

test.describe("Shipora Platform End-to-End User Flow", () => {
  test("landing page renders hero, feature cards, and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Zero-conflict deployments for multi-service monorepos.");
    await expect(page.getByText("AST PARSER · CONFLICT GUARD · 2-MIN ROLLBACK")).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect Repository/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Topology/i }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: /Architecture/i }).first()).toBeVisible();
  });

  test("dashboard page renders overview and navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Projects");
    await expect(page.getByText("WORKSPACES")).toBeVisible();
    await expect(page.getByText("CONFLICT GUARD")).toBeVisible();
    await expect(page.getByText("ECS RUNTIME")).toBeVisible();
    await expect(page.getByRole("link", { name: /Connect Repository/i })).toBeVisible();
  });

  test("complete new project onboarding flow", async ({ page }) => {
    await page.goto("/dashboard/new-project");
    await expect(page.locator("h1")).toContainText("Connect New Project");

    // Verify step tracker
    await expect(page.getByText("Step 1: Link GitHub Repository")).toBeVisible();

    // Verify sub-tabs
    const directTab = page.getByRole("button", { name: /Direct Repo Import/i });
    const tokenTab = page.getByRole("button", { name: /Personal Token/i });
    const appTab = page.getByRole("button", { name: /GitHub App/i });

    await expect(directTab).toBeVisible();
    await expect(tokenTab).toBeVisible();
    await expect(appTab).toBeVisible();

    // Verify direct input form
    const repoInput = page.getByPlaceholder(/facebook\/react or your-username/i);
    await expect(repoInput).toBeVisible();
    const verifyBtn = page.getByRole("button", { name: /Verify Repo/i });
    await expect(verifyBtn).toBeVisible();

    // Verify tab switching to GitHub App tab
    await appTab.click();
    await expect(page.getByText(/Custom GitHub App Integration/i)).toBeVisible();

    // Switch back to Direct Repo Import
    await directTab.click();
    await expect(repoInput).toBeVisible();
  });
});
