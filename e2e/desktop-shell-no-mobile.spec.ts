import { test, expect } from "@playwright/test";

/**
 * Desktop shell guard — Chrome desktop must NOT activate the mobile layout.
 *
 * At viewport widths > 900 px the following must hold:
 *   1. .ct-rail-left is visible (display !== 'none').
 *   2. .ct-rail-intra is NOT acting as a bottom bar
 *      (height < 100 px OR top < innerHeight − 80).
 *   3. .ct-page-area has no horizontal scroll (scrollWidth ≤ clientWidth + 4).
 *
 * Tested at 1440×900 and 1280×800 on /portfolio, /vaults, /proof-center.
 *
 * Design-system reference:
 *   cockpit.css L4771 — @media (max-width: 1199px) → chat hidden only
 *   cockpit.css L4775 — @media (max-width: 767px)  → padding narrowed only
 *   cockpit.css L5394 — @media (max-width: 900px)  → mobile mode (rail→bottom-bar)
 *
 * Navigation uses `domcontentloaded` to avoid hanging on indefinitely-polling
 * /api/chat-nav when the Master Agent flag is on (same pattern as other specs).
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

const DESKTOP_VIEWPORTS = [
  { name: "1440x900", w: 1440, h: 900 },
  { name: "1280x800", w: 1280, h: 800 },
] as const;

const PRODUCT_ROUTES = ["/portfolio", "/vaults", "/proof-center"] as const;

const NAV_OPTS = { waitUntil: "domcontentloaded" as const };

/** Stub chat-nav polling to prevent layout specs from hanging. */
async function stubChatNavPolling(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.route(/\/api\/chat-nav\b/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ route: null }),
    });
  });
}

test.describe("Desktop shell — no mobile layout above 900 px", () => {
  test.setTimeout(180_000);

  test("rail-left visible, intra-nav NOT bottom-bar, no horizontal scroll", async ({
    page,
  }) => {
    await stubChatNavPolling(page);

    // Auth once — same session is reused across route loops below.
    await page.goto("/login", NAV_OPTS);
    await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/portfolio", {
      timeout: 60_000,
      waitUntil: "commit",
    });

    for (const vp of DESKTOP_VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });

      for (const route of PRODUCT_ROUTES) {
        await page.goto(route, NAV_OPTS);

        // ── 1. Rail left must be visible ─────────────────────────────────────
        const railLeft = page.locator(".ct-rail-left").first();
        await expect(
          railLeft,
          `${vp.name} ${route}: .ct-rail-left must be in the DOM`,
        ).toBeAttached();

        const railLeftDisplay = await railLeft.evaluate(
          (el) => getComputedStyle(el).display,
        );
        expect(
          railLeftDisplay,
          `${vp.name} ${route}: .ct-rail-left display must NOT be 'none'`,
        ).not.toBe("none");

        // ── 2. Intra rail must NOT be acting as a fixed bottom bar ────────────
        //    Mobile mode sets: position:fixed, inset:auto 0 0 0, height:56px.
        //    Guard: height < 100 OR its top edge is above innerHeight − 80.
        const railIntra = page.locator(".ct-rail-intra").first();
        await expect(
          railIntra,
          `${vp.name} ${route}: .ct-rail-intra must be in the DOM`,
        ).toBeAttached();

        const intraProps = await railIntra.evaluate((el) => {
          const s = getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          return {
            height: rect.height,
            top: rect.top,
            position: s.position,
          };
        });

        const innerHeight = vp.h;
        const isBottomBar =
          intraProps.height >= 100 && intraProps.top >= innerHeight - 80;

        expect(
          isBottomBar,
          `${vp.name} ${route}: .ct-rail-intra must NOT be bottom-bar` +
            ` (h=${intraProps.height}px, top=${intraProps.top}px, position=${intraProps.position})`,
        ).toBe(false);

        // ── 3. No horizontal scroll on .ct-page-area ─────────────────────────
        const pageArea = page.locator(".ct-page-area").first();
        await expect(
          pageArea,
          `${vp.name} ${route}: .ct-page-area must be in the DOM`,
        ).toBeAttached();

        const hScroll = await pageArea.evaluate((el) => ({
          scrollWidth: el.scrollWidth,
          clientWidth: el.clientWidth,
        }));
        expect(
          hScroll.scrollWidth,
          `${vp.name} ${route}: .ct-page-area must have no horizontal scroll` +
            ` (scrollWidth=${hScroll.scrollWidth}, clientWidth=${hScroll.clientWidth})`,
        ).toBeLessThanOrEqual(hScroll.clientWidth + 4);
      }
    }
  });
});
