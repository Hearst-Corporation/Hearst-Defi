import { test, expect } from "@playwright/test";

/**
 * Portfolio cockpit responsive matrix — non-regression guard.
 *
 * Locks shell + hero layout at reference viewports × chat open/closed.
 * Hero column logic mirrors portfolio.css:
 *   - @container pf (min-width: 58rem) → 2-col when slot allows
 *   - fit-gate @media (min-width: 80rem) and (min-height: 52rem) +
 *     @container pf (max-width: 63.99rem) → force 1-col
 */

const TEST_EMAIL = "test@hearst.local";
const TEST_PASSWORD = "TestPassword123!";

const WIDTHS = [1600, 1440, 1280, 1024, 768, 390] as const;
const HEIGHT_BY_WIDTH: Record<number, number> = {
  1600: 900,
  1440: 900,
  1280: 800,
  1024: 768,
  768: 1024,
  390: 844,
};

/** portfolio.css fit-gate: min-width 80rem × min-height 52rem */
const FIT_GATE_MIN_WIDTH_PX = 80 * 16; /* 1280 */
const FIT_GATE_MIN_HEIGHT_PX = 52 * 16; /* 832 */
const HERO_2COL_MIN_SLOT_REM = 58;
const FIT_GATE_1COL_MAX_SLOT_REM = 64; /* 63.99rem in CSS */

const SIDEBAR_MIN_2COL_PX = 240;
const HSCROLL_TOL_PX = 4;
const CENTER_MIN_PX = 320;
const SLOT_TOL_PX = 8;

type ChatIntent = "open" | "closed";

interface RawMeasure {
  leftRailPx: number;
  intraRailPx: number;
  railLeftRemPx: number;
  chatPx: number;
  chatVisible: boolean;
  chatCollapsed: boolean;
  centerPx: number;
  pfSlotPx: number;
  sidebarPx: number;
  heroCols: 1 | 2;
  hScrollPx: number;
  footerOk: boolean;
  verticalText: string[];
}

function isFitGate(viewportW: number, viewportH: number): boolean {
  return viewportW >= FIT_GATE_MIN_WIDTH_PX && viewportH >= FIT_GATE_MIN_HEIGHT_PX;
}

/** Expected hero columns — mirrors portfolio.css container + fit-gate overrides. */
export function expectedHeroCols(
  viewportW: number,
  viewportH: number,
  pfSlotPx: number,
): 1 | 2 {
  const slotRem = pfSlotPx / 16;
  if (slotRem < HERO_2COL_MIN_SLOT_REM) return 1;
  if (isFitGate(viewportW, viewportH) && slotRem < FIT_GATE_1COL_MAX_SLOT_REM) {
    return 1;
  }
  return 2;
}

async function stubChatNav(page: import("@playwright/test").Page) {
  await page.route(/\/api\/chat-nav\b/, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ route: null }),
    });
  });
}

async function setChatMode(
  page: import("@playwright/test").Page,
  mode: ChatIntent,
) {
  await page.evaluate((m) => {
    localStorage.setItem(
      "cockpit:rail-right-mode",
      m === "open" ? "default" : "collapsed",
    );
    localStorage.setItem("cockpit:rail-right-open", m === "open" ? "1" : "0");
  }, mode);
  await page.reload({ waitUntil: "domcontentloaded" });
  // Target the real portfolio hub, not the loading skeleton (both share .pf-container)
  await page
    .locator('[data-portfolio-hub="true"]')
    .waitFor({ state: "visible", timeout: 30_000 });
}

async function measure(page: import("@playwright/test").Page): Promise<RawMeasure> {
  return page.evaluate(() => {
    const root = document.querySelector(".ct-root");
    const left = document.querySelector(".ct-rail-left");
    const intra = document.querySelector(".ct-rail-intra");
    const chat = document.querySelector(".ct-rail-right");
    const center = document.querySelector(".ct-center-panel");
    const pf = document.querySelector(".pf-container");
    const hero = document.querySelector(".pf-hero-grid");
    const sidebar = document.querySelector(".pf-hero-sidebar");
    const footer = document.querySelector(".app-footer");
    const main = document.querySelector("main#main-content");

    const rect = (el: Element | null) =>
      el ? el.getBoundingClientRect().width : 0;

    const chatStyle = chat ? getComputedStyle(chat) : null;
    const chatVisible =
      !!chat && chatStyle?.display !== "none" && rect(chat) > 0;
    const chatCollapsed = chat?.classList.contains("collapsed") ?? false;

    const heroColsRaw = hero
      ? getComputedStyle(hero).gridTemplateColumns
      : "";
    const heroCols: 1 | 2 =
      heroColsRaw.split(" ").filter(Boolean).length >= 2 ? 2 : 1;

    const hScrollPx =
      document.documentElement.scrollWidth - window.innerWidth;

    const footerRect = footer?.getBoundingClientRect();
    const footerOk = footerRect
      ? footerRect.bottom <= window.innerHeight + 4 ||
        (main
          ? main.scrollHeight <= main.clientHeight + 4 ||
            main.scrollTop + main.clientHeight >= main.scrollHeight - 4
          : window.scrollY + window.innerHeight >=
            document.documentElement.scrollHeight - 8)
      : true;

    const verticalText: string[] = [];
    const scope = pf ?? center ?? document.body;
    scope.querySelectorAll("*").forEach((el) => {
      if (!(el instanceof HTMLElement)) return;
      const cs = getComputedStyle(el);
      if (
        cs.writingMode !== "horizontal-tb" &&
        cs.writingMode !== "lr-tb" &&
        el.textContent?.trim()
      ) {
        verticalText.push(
          `${el.tagName}.${el.className.slice(0, 40)} writing-mode=${cs.writingMode}`,
        );
      }
      const t = cs.transform;
      if (
        t &&
        t !== "none" &&
        /rotate\([^)]*90|rotate\([^)]*270/.test(t) &&
        el.textContent?.trim()
      ) {
        verticalText.push(`${el.tagName} rotated text`);
      }
      const r = el.getBoundingClientRect();
      if (
        r.width > 0 &&
        r.width < 18 &&
        r.height > 72 &&
        (el.textContent?.trim().length ?? 0) > 4
      ) {
        verticalText.push(
          `narrow column ${el.className.slice(0, 30)} w=${r.width.toFixed(0)}`,
        );
      }
    });

    const railLeftRaw = root
      ? getComputedStyle(root).getPropertyValue("--ct-rail-left").trim()
      : "";
    const railLeftRemPx = railLeftRaw.endsWith("rem")
      ? parseFloat(railLeftRaw) * 16
      : parseFloat(railLeftRaw) || 0;

    return {
      leftRailPx: Math.round(rect(left)),
      intraRailPx: Math.round(rect(intra)),
      railLeftRemPx: Math.round(railLeftRemPx),
      chatPx: Math.round(rect(chat)),
      chatVisible,
      chatCollapsed,
      centerPx: Math.round(rect(center)),
      pfSlotPx: Math.round(rect(pf)),
      sidebarPx: Math.round(rect(sidebar)),
      heroCols,
      hScrollPx: Math.round(hScrollPx),
      footerOk,
      verticalText: verticalText.slice(0, 8),
    };
  });
}

function assertChatResponsive(
  viewportW: number,
  chat: ChatIntent,
  m: RawMeasure,
  label: string,
) {
  if (chat === "closed") {
    if (viewportW >= 1024) {
      expect(m.chatCollapsed, `${label}: chat collapsed`).toBe(true);
      // CSS target = 48px; ±10px tolerance for border/padding box-model differences
      expect(m.chatPx, `${label}: collapsed chat width`).toBeGreaterThanOrEqual(44);
      expect(m.chatPx, `${label}: collapsed chat width`).toBeLessThanOrEqual(64);
    }
    return;
  }

  if (viewportW < 1024) {
    expect(m.chatVisible, `${label}: chat hidden below 1024`).toBe(false);
    expect(m.chatPx, `${label}: no chat width`).toBe(0);
    return;
  }

  expect(m.chatVisible, `${label}: chat visible`).toBe(true);
  expect(m.chatCollapsed, `${label}: chat open not collapsed`).toBe(false);

  if (viewportW >= 1600) {
    expect(m.chatPx, `${label}: chat width @1600`).toBeGreaterThanOrEqual(360);
    expect(m.chatPx, `${label}: chat width @1600`).toBeLessThanOrEqual(440);
  } else if (viewportW >= 1440) {
    expect(m.chatPx, `${label}: chat width @1440`).toBeGreaterThanOrEqual(300);
    expect(m.chatPx, `${label}: chat width @1440`).toBeLessThanOrEqual(400);
  } else if (viewportW >= 1280) {
    expect(m.chatPx, `${label}: chat width @1280`).toBeGreaterThanOrEqual(280);
    expect(m.chatPx, `${label}: chat width @1280`).toBeLessThanOrEqual(360);
  } else {
    expect(m.chatPx, `${label}: chat width @1024`).toBeGreaterThanOrEqual(180);
    expect(m.chatPx, `${label}: chat width @1024`).toBeLessThanOrEqual(260);
  }

  const chatShare = m.chatPx / viewportW;
  expect(
    m.centerPx >= CENTER_MIN_PX || chatShare <= 0.32,
    `${label}: chat yields before center crush (center=${m.centerPx}px)`,
  ).toBe(true);
}

function assertLeftRailTier(viewportW: number, m: RawMeasure, label: string) {
  if (viewportW < 1024) {
    if (viewportW <= 899) {
      /* ≤899px: bottom intra bar spans the viewport (cockpit.css compact viewport). */
      expect(
        m.intraRailPx,
        `${label}: bottom intra bar active`,
      ).toBeGreaterThanOrEqual(viewportW - SLOT_TOL_PX);
      expect(m.intraRailPx, `${label}: bottom intra bar width`).toBeLessThanOrEqual(
        viewportW + SLOT_TOL_PX,
      );
    }
    if (viewportW <= 767) {
      expect(m.railLeftRemPx, `${label}: --ct-rail-left @≤767`).toBeGreaterThanOrEqual(60);
      expect(m.railLeftRemPx, `${label}: --ct-rail-left @≤767`).toBeLessThanOrEqual(68);
    }
    return;
  }

  const railPx = m.leftRailPx;
  if (viewportW > 1440) {
    expect(railPx, `${label}: left rail @1600`).toBeGreaterThanOrEqual(100);
    expect(railPx, `${label}: left rail @1600`).toBeLessThanOrEqual(108);
  } else if (viewportW >= 1201) {
    expect(railPx, `${label}: left rail @1440/1280`).toBeGreaterThanOrEqual(76);
    expect(railPx, `${label}: left rail @1440/1280`).toBeLessThanOrEqual(84);
  } else {
    expect(railPx, `${label}: left rail @1024`).toBeGreaterThanOrEqual(68);
    expect(railPx, `${label}: left rail @1024`).toBeLessThanOrEqual(76);
  }
}

function assertSidebar(
  m: RawMeasure,
  label: string,
) {
  if (m.heroCols === 2) {
    expect(m.sidebarPx, `${label}: 2-col sidebar min`).toBeGreaterThanOrEqual(
      SIDEBAR_MIN_2COL_PX,
    );
    expect(m.sidebarPx, `${label}: sidebar within slot`).toBeLessThanOrEqual(
      m.pfSlotPx + SLOT_TOL_PX,
    );
    return;
  }

  const minFull = Math.min(320, m.pfSlotPx - SLOT_TOL_PX);
  expect(m.sidebarPx, `${label}: 1-col sidebar full width`).toBeGreaterThanOrEqual(
    minFull,
  );
}

function assertMatrixRow(
  viewportW: number,
  viewportH: number,
  chat: ChatIntent,
  m: RawMeasure,
) {
  const label = `${viewportW}×${viewportH} chat=${chat}`;

  expect(m.hScrollPx, `${label}: horizontal scroll`).toBeLessThanOrEqual(
    HSCROLL_TOL_PX,
  );
  expect(m.verticalText, `${label}: vertical text`).toEqual([]);
  expect(m.footerOk, `${label}: footer visible or clean scroll`).toBe(true);

  const wantCols = expectedHeroCols(viewportW, viewportH, m.pfSlotPx);
  expect(m.heroCols, `${label}: hero columns (want ${wantCols})`).toBe(wantCols);

  assertSidebar(m, label);
  assertChatResponsive(viewportW, chat, m, label);
  assertLeftRailTier(viewportW, m, label);
}

test.describe("Portfolio shell responsive matrix", () => {
  test("locks layout at reference viewports × chat open/closed", async ({
    page,
  }) => {
    test.setTimeout(300_000);

    await stubChatNav(page);
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel(/^email$/i).fill(TEST_EMAIL);
    await page.getByLabel(/^password$/i).fill(TEST_PASSWORD);
    await page.getByRole("button", { name: /sign in/i }).click();
    await page.waitForURL("**/portfolio", { timeout: 60_000 });

    for (const w of WIDTHS) {
      const h = HEIGHT_BY_WIDTH[w] ?? 900;
      for (const chat of ["open", "closed"] as const) {
        await page.setViewportSize({ width: w, height: h });
        await setChatMode(page, chat);
        await page.waitForTimeout(200);

        const m = await measure(page);

        // eslint-disable-next-line no-console
        console.log(
          JSON.stringify({
            viewport: `${w}×${h}`,
            chat,
            wantCols: expectedHeroCols(w, h, m.pfSlotPx),
            fitGate: isFitGate(w, h),
            slotRem: (m.pfSlotPx / 16).toFixed(1),
            ...m,
          }),
        );

        assertMatrixRow(w, h, chat, m);
      }
    }
  });
});

test.describe("expectedHeroCols unit guard", () => {
  test("reference matrix expectations", () => {
    const cases: Array<[number, number, number, 1 | 2]> = [
      [1600, 900, 1060, 2],
      [1600, 900, 1412, 2],
      [1440, 900, 964, 1],
      [1440, 900, 1276, 2],
      [1280, 800, 844, 1],
      [1280, 800, 1116, 2],
      [1024, 768, 691, 1],
      [1024, 768, 868, 1],
    ];
    for (const [w, h, slot, cols] of cases) {
      expect(expectedHeroCols(w, h, slot)).toBe(cols);
    }
  });
});
