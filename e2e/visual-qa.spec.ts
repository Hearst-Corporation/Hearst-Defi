import { test, expect, type Page } from "@playwright/test";

/**
 * Visual QA — UI/UX Rebuild Series, batch 7/8.
 *
 * Real-browser regression check for the screens touched by batches 3-6 of this
 * series (panel header canon, nav registry, rgba()->token DS hardening,
 * responsive breakpoint audit): each route renders its heading, does not
 * overflow horizontally, and passes a lightweight DOM-level a11y smoke check
 * at 3 breakpoints (mobile/tablet/desktop). Also verifies the honest
 * logged-out state (redirect to /login, no content leak) for every route.
 *
 * Auth matches the existing e2e conventions:
 * - Investor: e2e/login-flow.spec.ts / e2e/dashboard.spec.ts constants
 *   (requires `pnpm seed:test`).
 * - Admin: e2e/outreach-master-agent.spec.ts constants (requires
 *   `pnpm seed:test:admin`). CI runs both seeds before `pnpm test:e2e`.
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

const ADMIN_EMAIL = process.env.TEST_ADMIN_EMAIL ?? "admin@hearst.io";
const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD ?? "TestAdmin123!";

const BREAKPOINTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function investorLogin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
  await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL("**/portfolio", { timeout: 15_000 });
}

async function adminLogin(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByLabel(/^email$/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/^password$/i).fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/(portfolio|admin)/, { timeout: 15_000 });
}

// The document must never grow wider than its own viewport — a horizontal
// scrollbar on a cockpit surface is the exact "grid/flex without a responsive
// variant inside an overflow-hidden panel" bug class batch 6 of this series
// fixed on 3 other components (dashboard-kpi-strip, monte-carlo-review,
// crew-simulation-section).
async function assertNoHorizontalOverflow(page: Page, viewportWidth: number) {
  const scrollWidth = await page.evaluate(
    () => document.documentElement.scrollWidth,
  );
  expect(
    scrollWidth,
    `document.documentElement.scrollWidth (${scrollWidth}px) should not exceed the ${viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(viewportWidth + 1);
}

// Dependency-free DOM a11y smoke check. axe-core is only a transitive
// dependency in this repo (no @axe-core/playwright wired in) and package.json
// is a sensitive single-owner file (CLAUDE.md) not touched by this batch — so
// this asserts the same invariants a first-pass axe rule set would flag,
// without adding a new dependency.
async function assertBasicA11y(page: Page) {
  const violations = await page.evaluate(() => {
    const issues: string[] = [];

    const h1s = document.querySelectorAll("h1");
    if (h1s.length !== 1) {
      issues.push(`expected exactly one <h1>, found ${h1s.length}`);
    }

    document.querySelectorAll("img").forEach((img) => {
      if (!img.hasAttribute("alt")) {
        issues.push(`<img> missing alt attribute: ${img.getAttribute("src") ?? "(no src)"}`);
      }
    });

    document.querySelectorAll("button").forEach((btn) => {
      const accessibleName =
        (btn.textContent ?? "").trim() ||
        btn.getAttribute("aria-label") ||
        btn.getAttribute("title");
      if (!accessibleName) {
        issues.push(`<button> has no accessible name: ${btn.outerHTML.slice(0, 120)}`);
      }
    });

    if (document.querySelectorAll("main, [role='main']").length === 0) {
      issues.push("no <main> / [role=main] landmark found");
    }

    return issues;
  });

  expect(violations, `a11y violations found: ${JSON.stringify(violations)}`).toEqual([]);
}

async function assertRouteAtBreakpoints(
  page: Page,
  path: string,
  headingName: RegExp,
) {
  for (const bp of BREAKPOINTS) {
    await test.step(`${bp.name} (${bp.width}x${bp.height})`, async () => {
      await page.setViewportSize({ width: bp.width, height: bp.height });
      await page.goto(path);
      await expect(
        page.getByRole("heading", { level: 1, name: headingName }),
      ).toBeVisible();
      await assertNoHorizontalOverflow(page, bp.width);
      await assertBasicA11y(page);
    });
  }
}

test.describe("Visual QA — investor product routes (3 breakpoints)", () => {
  test("portfolio: heading, no overflow, a11y", async ({ page }) => {
    await investorLogin(page);
    await assertRouteAtBreakpoints(page, "/portfolio", /Portfolio Cockpit/i);
  });

  test("vaults: heading, no overflow, a11y", async ({ page }) => {
    await investorLogin(page);
    await assertRouteAtBreakpoints(page, "/vaults", /Hearst Bitcoin Reserve Vault/i);
  });

  test("proof-center: heading, no overflow, a11y", async ({ page }) => {
    await investorLogin(page);
    await assertRouteAtBreakpoints(page, "/proof-center", /Proof Center/i);
  });
});

test.describe("Visual QA — admin routes (3 breakpoints)", () => {
  test("admin dashboard: heading, no overflow, a11y", async ({ page }) => {
    await adminLogin(page);
    await assertRouteAtBreakpoints(
      page,
      "/admin/dashboard",
      /Admin Command Center/i,
    );
  });

  test("admin strategies: heading, no overflow, a11y", async ({ page }) => {
    await adminLogin(page);
    await assertRouteAtBreakpoints(page, "/admin/strategies", /Strategy Hub/i);
  });
});

test.describe("Visual QA — logged-out state honesty", () => {
  test("protected investor routes redirect anonymous visitors to /login", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    for (const path of ["/portfolio", "/vaults", "/proof-center"]) {
      await page.goto(path);
      await expect(page, `GET ${path} while logged out`).toHaveURL(/\/login/);
    }
  });

  test("protected admin routes redirect anonymous visitors to /login", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    for (const path of ["/admin/dashboard", "/admin/strategies"]) {
      await page.goto(path);
      await expect(page, `GET ${path} while logged out`).toHaveURL(/\/login/);
    }
  });
});
