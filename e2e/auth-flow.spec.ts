import { test, expect } from "@playwright/test";

/**
 * End-to-end authentication flow using real email/password credentials.
 *
 * Uses the investor account seeded by `pnpm seed:test` (same as
 * e2e/login-flow.spec.ts). Constants are duplicated rather than imported from
 * scripts/ because Playwright runs specs outside the tsconfig path-alias graph.
 * Keep in sync with `scripts/seed-test-user.ts`.
 *
 * The profile page exposes the real email/password "Sign out" form. Use that
 * path so the test exercises the server action that destroys the session row
 * and clears the `hc_session` cookie.
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
      page.getByRole("heading", { name: /^portfolio$/i }),
    ).toBeVisible();

    // 6. Sign out through the real profile form.
    await page.goto("/profile");
    await page.getByRole("button", { name: /^Sign out$/i }).click();
    await page.waitForURL("/login**");

    // 7. Visit a protected route and verify redirect back to /login
    await page.goto("/portfolio");
    await page.waitForURL("/login**");
    await expect(page.getByRole("heading", { name: /Sign in/i })).toBeVisible();
  });
});
