import { test, expect, type Locator } from "@playwright/test";

/**
 * Portfolio zero-state — cockpit LAYOUT GEOMETRY guard.
 *
 * The SSR string-match unit tests (portfolio-zero-render / portfolio-zero-position)
 * cannot see the P1 viewport-fit bug: a fixed chart min-height (16→20rem) fighting
 * the height-capped summary row + overflow:hidden clips the chart disclaimer and the
 * 3rd hero rail. This spec MEASURES it: at the three reference sizes it asserts the
 * disclaimer + Liquidity rail are not clipped by the hero cell, and that viewport-fit
 * carries NO top-level scroll. See docs/PORTFOLIO_ZERO_CONTRACT.md.
 *
 * Reuses the seeded zero-position investor (scripts/seed-test-user.ts → no positions,
 * so /portfolio renders previewZeros). Run `pnpm seed:test` once first.
 */

// Mirrors e2e/dashboard.spec.ts + scripts/seed-test-user.ts.
const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

// 90rem×52rem = 1440×832px viewport-fit gate.
const VIEWPORTS = [
  { name: "1280x800 scroll-mode", w: 1280, h: 800, fit: false },
  { name: "1536x900 viewport-fit", w: 1536, h: 900, fit: true },
  { name: "1600x850 viewport-fit (P1 case)", w: 1600, h: 850, fit: true },
] as const;

const CLIP_TOLERANCE_PX = 4;

/** Assert `el`'s bottom edge sits within `container`'s bottom (not overflow-clipped). */
async function expectNotClipped(
  el: Locator,
  container: Locator,
  label: string,
): Promise<void> {
  const elBox = await el.boundingBox();
  const cBox = await container.boundingBox();
  expect(elBox, `${label}: element has a box`).not.toBeNull();
  expect(cBox, `${label}: hero cell has a box`).not.toBeNull();
  if (!elBox || !cBox) return;
  expect(
    elBox.y + elBox.height,
    `${label}: bottom must stay within the hero cell (clip = P1 regression)`,
  ).toBeLessThanOrEqual(cBox.y + cBox.height + CLIP_TOLERANCE_PX);
}

test.describe("Portfolio zero-state — cockpit layout geometry", () => {
  test("disclaimer + 3rd rail never clipped; no top-level scroll in viewport-fit", async ({
    page,
  }) => {
    // Real DB sign-in (no dev bypass) — same path as dashboard.spec.ts.
    await page.goto("/login");
    await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/portfolio", { timeout: 10_000 });

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto("/portfolio");
      await page.waitForLoadState("networkidle");

      // We are in the FROZEN zero-state (ghost chart, no CTA) — contract guard.
      await expect(
        page.getByText("Awaiting first position"),
        `${vp.name}: zero-state ghost chart present`,
      ).toBeVisible();
      await expect(
        page.getByText(/Subscribe to Hearst Yield Vault|Get started/),
        `${vp.name}: no CTA leaked back into zero-state`,
      ).toHaveCount(0);

      const heroCell = page
        .locator(".pf-cockpit-row--summary .pf-cockpit-cell")
        .first();
      const disclaimer = page.getByText(
        "Placeholder chart until your first confirmed position.",
      );
      const liquidityRail = page.locator('[aria-label="Liquidity status"]');

      await expect(disclaimer, `${vp.name}: disclaimer visible`).toBeVisible();
      await expect(
        liquidityRail,
        `${vp.name}: liquidity (3rd) rail visible`,
      ).toBeVisible();

      await expectNotClipped(disclaimer, heroCell, `${vp.name} disclaimer`);
      await expectNotClipped(liquidityRail, heroCell, `${vp.name} liquidity rail`);

      if (vp.fit) {
        const overflow = await page.evaluate(() => ({
          v: document.documentElement.scrollHeight - window.innerHeight,
          h: document.documentElement.scrollWidth - window.innerWidth,
        }));
        expect(
          overflow.v,
          `${vp.name}: no vertical top-level scroll`,
        ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);
        expect(
          overflow.h,
          `${vp.name}: no horizontal top-level scroll`,
        ).toBeLessThanOrEqual(CLIP_TOLERANCE_PX);
      }
    }
  });
});
