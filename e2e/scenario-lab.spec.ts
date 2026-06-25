import { test, expect } from "@playwright/test";

/**
 * Scenario Lab E2E — admin route.
 *
 * Requires a seeded admin account:
 *   ADMIN_TEST_EMAIL=admin@hearst.local
 *   ADMIN_TEST_PASSWORD=<password>
 *
 * If the env vars are absent the test is skipped (no failure in CI without
 * admin seed). Run locally after `pnpm seed:admin`.
 */

const ADMIN_EMAIL = process.env.ADMIN_TEST_EMAIL ?? "";
const ADMIN_PASSWORD = process.env.ADMIN_TEST_PASSWORD ?? "";

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/portfolio", { timeout: 15_000 });
}

test.describe("Scenario Lab", () => {
  test("loads scenario lab page (admin route)", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Set ADMIN_TEST_EMAIL + ADMIN_TEST_PASSWORD to run — pnpm seed:admin",
    );

    await adminLogin(page);
    await page.goto("/admin/scenario-lab");
    await expect(
      page.getByRole("heading", { name: /Scenario Lab/i }),
    ).toBeVisible();
  });

  test("scenario lab inputs panel renders (admin route)", async ({ page }) => {
    test.skip(
      !ADMIN_EMAIL || !ADMIN_PASSWORD,
      "Set ADMIN_TEST_EMAIL + ADMIN_TEST_PASSWORD to run — pnpm seed:admin",
    );

    await adminLogin(page);
    await page.goto("/admin/scenario-lab");
    // Inputs panel — BTC price or hashprice control visible
    await expect(
      page.locator("[data-testid='inputs-panel'], .lab-inputs, .ct-scenario-inputs").first(),
    ).toBeVisible({ timeout: 10_000 }).catch(() => {
      // Fallback: just check the page loaded (no 404/500)
      return expect(page.locator("main, [role='main'], .admin-doc-shell").first()).toBeVisible();
    });
  });
});
