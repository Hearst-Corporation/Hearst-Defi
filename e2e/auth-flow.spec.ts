import { test, expect } from "@playwright/test";

/**
 * End-to-end authentication flow using real email/password credentials.
 *
 * Uses the investor account seeded by `pnpm seed:test` (same as
 * e2e/login-flow.spec.ts). Constants are duplicated rather than imported from
 * scripts/ because Playwright runs specs outside the tsconfig path-alias graph.
 * Keep in sync with `scripts/seed-test-user.ts`.
 *
 * NOTE: There is currently no visible "Logout" button for email/password
 * sessions in the UI. The sign-out step is therefore simulated by clearing the
 * `hc_session` cookie, which causes the edge proxy to redirect back to /login
 * on the next protected-route visit — exactly the same outcome as a real
 * logout.
 */

// Must match scripts/seed-test-user.ts (seeded in CI before Playwright runs).
const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

test.describe("Auth flow", () => {
  // Ensure each test in this file starts with a completely clean session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test("signs in with seeded investor and is gated after sign-out", async ({ page }) => {
    // 1. Go to login page
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();

    // 2. Fill credentials (seeded by pnpm seed:test)
    await page.getByLabel(/Email/i).fill(TEST_EMAIL);
    await page.getByLabel(/Password/i).fill(TEST_PASSWORD);

    // 3. Click Sign in
    await page.getByRole("button", { name: /^Sign in$/i }).click();

    // 4. Verify redirect to /portfolio
    await page.waitForURL("/portfolio");

    // 5. Verify auth success indicator (portfolio greeting is visible)
    await expect(
      page.getByRole("heading", { name: /Welcome back,/i }),
    ).toBeVisible();

    // 6. Simulate logout — clear the session cookie
    //    (No logout UI control exists for email/password auth at this time.)
    await page.context().clearCookies();

    // 7. Visit a protected route and verify redirect back to /login
    await page.goto("/portfolio");
    await page.waitForURL("/login**");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  });
});
