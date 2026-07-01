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
    // Never reuse an existing server — it may be running with Postgres env vars
    // (.env.local) while e2e needs SQLite. Playwright always starts a fresh
    // process with the env block below, ensuring the right adapter is used.
    reuseExistingServer: false,
    timeout: 120_000,
    // Force E2E to exercise the real auth path: no dev bypass, no UI shortcut.
    // The login-flow spec seeds a real user via `pnpm seed:test` and signs in
    // through the actual form + server action.
    env: {
      // Use environment variable or resolve from project root using process.cwd()
      // to ensure consistency with the seed scripts and CI workflow.
      DATABASE_URL:
        process.env.DATABASE_URL ??
        `file:${require("path").resolve(process.cwd(), "prisma/dev.db")}`,
      // Pin provider to sqlite for e2e — overrides PRISMA_PROVIDER=postgresql
      // in .env.local so the Better-SQLite3 adapter is used against dev.db.
      PRISMA_PROVIDER: "sqlite",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "sk-e2e-local-placeholder",
      DEV_AUTH_BYPASS: "",
      // Hard-gated in src/lib/rate-limit.ts: refuses in production builds.
      // Lets the login-flow spec hammer the form without saturating the
      // 10/min IP and 5/15min email buckets (Upstash persists state).
      E2E_DISABLE_RATE_LIMIT: "1",
    },
  },
});
