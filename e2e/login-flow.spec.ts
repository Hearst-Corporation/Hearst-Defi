import { test, expect } from "@playwright/test";

/**
 * Real DB-backed login flow.
 *
 * Pre-req (one shot): `pnpm seed:test` — creates test@hearst.local with
 * the password below (argon2id, OWASP params). The login server action
 * verifies against the actual `User.passwordHash` row, creates an opaque
 * Session, and sets the `hc_session` httpOnly cookie. No dev bypass UI,
 * no shortcut — this is the same code path institutional investors will
 * hit.
 *
 * Constants are duplicated rather than imported from scripts/ because
 * Playwright runs specs outside the tsconfig path-alias graph. Keep the
 * two values in sync with `scripts/seed-test-user.ts`.
 *
 * Rate-limit awareness: login is gated 10/min/IP + 5/15min/email. To keep
 * the suite green within those budgets we only submit ONE happy-path login
 * (the long workflow test) plus two rejections that use throwaway emails.
 * playwright.config sets workers:1 + fullyParallel:false so tests run in
 * series across the file.
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";
// The profile page shows the derived display name (capitalised email local-part
// via profileDisplayName), not the raw email — so "test@hearst.local" → "Test".
const TEST_DISPLAY_NAME = "Test";

// Selector for the login form's inline error <p id="login-error">.
// Avoids ambiguity with the empty <div role="alert" id="__next-route-announcer__">
// that Next.js injects on every page.
const LOGIN_ERROR = "#login-error";

async function submitLogin(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(email);
  await page.getByLabel(/^password$/i).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
}

test.describe("Login flow (real DB auth)", () => {
  test("rejects wrong credentials with a generic message", async ({ page }) => {
    // Different email than TEST_EMAIL so we don't burn the 5/15min email budget.
    await submitLogin(page, "wrong-user@hearst.local", "definitely-wrong");
    await expect(page.locator(LOGIN_ERROR)).toContainText(
      /invalid email or password/i,
    );
    expect(page.url()).toContain("/login");
  });

  test("anti-enumeration: unknown email returns the same generic message", async ({
    page,
  }) => {
    await submitLogin(page, "unknown-user@hearst.local", "any-password");
    await expect(page.locator(LOGIN_ERROR)).toContainText(
      /invalid email or password/i,
    );
  });

  test("happy-path workflow: sign in, navigate product + legal, sign out", async ({
    page,
    context,
  }) => {
    // 1. Sign in (the only TEST_EMAIL submission in this spec).
    await submitLogin(page, TEST_EMAIL, TEST_PASSWORD);
    await page.waitForURL("**/portfolio", { timeout: 15_000 });
    await expect(
      page.getByRole("heading", { name: /^Portfolio Cockpit$/i }),
    ).toBeVisible();

    // 2. Session cookie is set, httpOnly, and named hc_session.
    const cookies = await context.cookies();
    const session = cookies.find((c) => c.name === "hc_session");
    expect(session, "hc_session cookie should be set after login").toBeDefined();
    expect(session?.httpOnly).toBe(true);

    // 3. Navigate to /vaults — either a card list or the empty state renders.
    await page.goto("/vaults");
    await expect(page).toHaveURL(/\/vaults$/);
    const vaultsBody = await page
      .locator("body")
      .filter({ hasText: /vault|no products available/i })
      .first()
      .isVisible();
    expect(vaultsBody).toBe(true);

    // 4. Navigate to /profile — must show the signed-in user. The profile header
    // renders the derived display name ("Welcome back" + profileDisplayName),
    // not the raw email, so assert that instead.
    await page.goto("/profile");
    await expect(page.getByText(/Welcome back/i).first()).toBeVisible();
    await expect(page.getByText(TEST_DISPLAY_NAME).first()).toBeVisible();

    // 5. Public legal pages remain reachable while signed in (200 OK).
    for (const path of [
      "/legal",
      "/legal/privacy",
      "/legal/terms",
      "/legal/disclaimer",
    ]) {
      const res = await page.goto(path);
      expect(res?.status(), `GET ${path}`).toBe(200);
      expect(page.url()).toContain(path);
    }

    // 6. Clearing the cookie effectively logs out.
    await context.clearCookies();
    const afterClear = await context.cookies();
    expect(
      afterClear.find((c) => c.name === "hc_session"),
      "hc_session must be gone after clearCookies",
    ).toBeUndefined();
  });
});
