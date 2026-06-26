import { test, expect } from "@playwright/test";

// Same constants as e2e/login-flow.spec.ts (mirrors scripts/seed-test-user.ts).
const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

test.describe("Dashboard", () => {
  test("loads /portfolio after real DB sign-in", async ({ page }) => {
    // No dev bypass — go through the actual login form + server action.
    // Requires `pnpm seed:test` to have been run at least once.
    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/portfolio", { timeout: 10_000 });
    await expect(
      page.getByRole("heading", { name: /^portfolio$/i }),
    ).toBeVisible();
  });
});
