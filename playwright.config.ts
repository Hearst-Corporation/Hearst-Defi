import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for Hearst Connect E2E tests.
 *
 * Tests run against the local dev server on port 4105.
 * Install browsers with: pnpm exec playwright install chromium
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Serial across files too. Several specs hit the real login form, and the
  // login rate-limit (10/min/IP + 5/15min/email) is keyed on TEST_USER_EMAIL —
  // parallel workers cascade-fail it. Trade ~30s of latency for determinism.
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:4105",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:4105",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Force E2E to exercise the real auth path: no dev bypass, no UI shortcut.
    // The login-flow spec seeds a real user via `pnpm seed:test` and signs in
    // through the actual form + server action.
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "file:./prisma/dev.db",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "sk-e2e-local-placeholder",
      DEV_AUTH_BYPASS: "",
      // Hard-gated in src/lib/rate-limit.ts: refuses in production builds.
      // Lets the login-flow spec hammer the form without saturating the
      // 10/min IP and 5/15min email buckets (Upstash persists state).
      E2E_DISABLE_RATE_LIMIT: "1",
    },
  },
});
