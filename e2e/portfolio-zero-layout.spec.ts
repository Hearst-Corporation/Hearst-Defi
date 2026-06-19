import { test, expect } from "@playwright/test";

/**
 * Portfolio previewZeros — ghost-chart cockpit layout guard.
 *
 * Asserts the honest zero-state hero (placeholder chart, compact rails) and
 * viewport clip/scroll rules per docs/PORTFOLIO_ZERO_CONTRACT.md.
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

const VIEWPORTS = [
  { name: "1280x800", w: 1280, h: 800, expectNoTopScroll: false },
  { name: "1536x900", w: 1536, h: 900, expectNoTopScroll: true },
  { name: "1600x850", w: 1600, h: 850, expectNoTopScroll: true },
] as const;

const CLIP_TOLERANCE_PX = 4;
const NAV_OPTS = { waitUntil: "domcontentloaded" as const };

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

test.describe("Portfolio previewZeros — ghost cockpit layout", () => {
  test("placeholder chart visible, no onboarding CTA hero, layout guards", async ({
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

    const chartPanel = page.locator(".pf-value-chart");
    await expect(chartPanel).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("Awaiting first position")).toBeVisible();
    const disclaimer = page.getByText(
      "Placeholder chart until your first confirmed position.",
    );
    await expect(disclaimer).toBeVisible();
    const liquidityMeta = page.getByText("60-day soft lock shown after deposit");

    await expect(
      page.getByRole("link", { name: /subscribe to vault/i }),
    ).toHaveCount(0);
    await expect(page.getByText("Get started", { exact: true })).toHaveCount(0);
    await expect(page.getByTestId("portfolio-onboarding-foot")).toHaveCount(0);

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });

      await expect(
        chartPanel,
        `${vp.name}: ghost chart panel visible`,
      ).toBeVisible();
      await expect(disclaimer, `${vp.name}: chart disclaimer visible`).toBeVisible();
      await expect(
        liquidityMeta,
        `${vp.name}: liquidity rail meta visible`,
      ).toBeVisible();

      const overflow = await page.evaluate(() => ({
        h: document.documentElement.scrollWidth - window.innerWidth,
      }));
      expect(
        overflow.h,
        `${vp.name}: no horizontal scroll`,
      ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);

      if (vp.expectNoTopScroll) {
        const layout = await page.evaluate(() => {
          const main = document.querySelector("main#main-content");
          return {
            scrollY: window.scrollY,
            mainScrollTop: main?.scrollTop ?? 0,
          };
        });
        expect(
          layout.scrollY,
          `${vp.name}: no window scroll in fit gate`,
        ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);
        expect(
          layout.mainScrollTop,
          `${vp.name}: no main scroll in fit gate`,
        ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);

        const clipCheck = await page.evaluate((tolerance) => {
          const disclaimerEl = [...document.querySelectorAll("p")].find((el) =>
            el.textContent?.includes(
              "Placeholder chart until your first confirmed position.",
            ),
          );
          const liquidityEl = [...document.querySelectorAll("p")].find((el) =>
            el.textContent?.includes("60-day soft lock shown after deposit"),
          );
          const vh = window.innerHeight;
          const bottom = (el: Element | undefined) => {
            if (!el) return 0;
            return el.getBoundingClientRect().bottom;
          };
          return {
            disclaimerBottom: bottom(disclaimerEl),
            liquidityBottom: bottom(liquidityEl),
            vh,
            tolerance,
          };
        }, CLIP_TOLERANCE_PX);

        expect(
          clipCheck.disclaimerBottom,
          `${vp.name}: disclaimer not clipped`,
        ).toBeLessThanOrEqual(clipCheck.vh + clipCheck.tolerance);
        expect(
          clipCheck.liquidityBottom,
          `${vp.name}: liquidity rail not clipped`,
        ).toBeLessThanOrEqual(clipCheck.vh + clipCheck.tolerance);
      }
    }
  });
});
