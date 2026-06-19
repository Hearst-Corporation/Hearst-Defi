import { test, expect } from "@playwright/test";

/**
 * Portfolio previewZeros — onboarding cockpit layout guard.
 *
 * Asserts CTA-led zero state (no ghost chart), compact empty panels, and no
 * footer overlap / horizontal scroll at reference breakpoints.
 *
 * Navigation uses `domcontentloaded` (not `load`) — authenticated shells poll
 * `/api/chat-nav` indefinitely when the Master Agent is on, so `load` never
 * fires. Rate-limit bypass for login is set in `playwright.config.ts`
 * (`E2E_DISABLE_RATE_LIMIT=1`, dev/CI only).
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

const VIEWPORTS = [
  { name: "390x844", w: 390, h: 844 },
  { name: "768x1024", w: 768, h: 1024 },
  { name: "1024x768", w: 1024, h: 768 },
  { name: "1280x800", w: 1280, h: 800 },
  { name: "1536x900", w: 1536, h: 900 },
] as const;

const CLIP_TOLERANCE_PX = 4;
const NAV_OPTS = { waitUntil: "domcontentloaded" as const };

/** Stub chat-nav polling so layout specs do not hang on perpetual network activity. */
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

test.describe("Portfolio previewZeros — onboarding cockpit layout", () => {
  test("CTA visible, no fake chart, footer not overlapping panels", async ({
    page,
  }) => {
    test.setTimeout(120_000);

    await stubChatNavPolling(page);

    await page.goto("/login", NAV_OPTS);
    await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/portfolio", {
      timeout: 60_000,
      waitUntil: "commit",
    });

    const cta = page.getByRole("link", { name: /subscribe to vault/i });
    await expect(cta).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("#main-content")).toBeVisible();

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });

      await expect(
        cta,
        `${vp.name}: primary CTA visible`,
      ).toBeVisible();
      await expect(
        page.getByText("Get started", { exact: true }),
        `${vp.name}: onboarding hero title`,
      ).toBeVisible();

      await expect(
        page.getByText("Awaiting first position"),
        `${vp.name}: no ghost chart subtitle`,
      ).toHaveCount(0);
      await expect(
        page.getByText("Placeholder chart until your first confirmed position."),
        `${vp.name}: no chart disclaimer`,
      ).toHaveCount(0);
      await expect(
        page.locator(".pf-value-chart"),
        `${vp.name}: no value chart panel`,
      ).toHaveCount(0);

      await expect(
        page.getByText("Awaiting snapshot"),
        `${vp.name}: no empty donut`,
      ).toHaveCount(0);
      await expect(
        page.getByText("Product terms", { exact: true }),
        `${vp.name}: no duplicate product terms rail`,
      ).toHaveCount(0);
      await expect(
        page.getByTestId("portfolio-onboarding-foot"),
        `${vp.name}: compact secondary foot`,
      ).toBeVisible();

      const footer = page.locator(".app-footer");
      const footerBox = await footer.boundingBox();
      const ctaBox = await cta.boundingBox();
      expect(footerBox, `${vp.name}: footer has layout box`).not.toBeNull();
      expect(ctaBox, `${vp.name}: CTA hero has layout box`).not.toBeNull();
      if (footerBox && ctaBox) {
        expect(
          ctaBox.y + ctaBox.height,
          `${vp.name}: CTA must sit above footer`,
        ).toBeLessThanOrEqual(footerBox.y + CLIP_TOLERANCE_PX);
      }

      const overflow = await page.evaluate(() => ({
        h: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(
        overflow.h,
        `${vp.name}: no horizontal scroll`,
      ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);
    }
  });
});
