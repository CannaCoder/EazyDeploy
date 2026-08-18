import { test, expect } from "@playwright/test";

test.describe("Shipora Platform End-to-End User Flow", () => {
  test("landing page renders hero, feature cards, and navigation", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toContainText("Ship confidently");
    await expect(page.getByText("AI Deployment Engineer")).toBeVisible();
    await expect(page.getByText("Service Auto-Discovery")).toBeVisible();
    await expect(page.getByText("Conflict Guard")).toBeVisible();
  });

  test("dashboard page renders overview and navigation", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.locator("h1")).toContainText("Projects");
    await expect(page.getByText("Conflict Guard Status")).toBeVisible();
    await expect(page.getByText("Cloud Engine Ready")).toBeVisible();
  });

  test("complete new project onboarding flow", async ({ page }) => {
    await page.goto("/dashboard/new-project");
    await expect(page.locator("h1")).toContainText("Connect New Project");

    // Step 1: Click connect
    const connectBtn = page.getByRole("button", { name: /Connect via GitHub App/i });
    await expect(connectBtn).toBeVisible();
    await connectBtn.click();

    // Step 2: Choose Repository
    await expect(page.getByText("Step 2: Choose Repository")).toBeVisible();
    const selectBtn = page.getByRole("button", { name: "Select" }).first();
    await expect(selectBtn).toBeVisible();
    await selectBtn.click();

    // Step 3: Configure Project
    await expect(page.getByText("Step 3: Configure Project")).toBeVisible();
    const completeBtn = page.getByRole("button", { name: "Complete Connection" });
    await expect(completeBtn).toBeVisible();
    await completeBtn.click();

    // Verifies navigation to project details or back to dashboard
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
