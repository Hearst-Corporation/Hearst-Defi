// Dashboard backend-down guard — the live load
// (`Promise.all([getDashboard, getMining, getBtcPageData])`) is wrapped in try/catch
// (mirrors /btc). When hearst-connect-backend is down, getDashboard() throws a
// BackendError; the page must render an HONEST page-level error inside the
// BentoPageShell — NOT crash into the Product Error overlay, NOT substitute a
// fixture, NOT show a Live/provenance badge.
//
// Pattern: renderToStaticMarkup(await DashboardPage(...)) — vitest env = node
// (no jsdom/RTL), same idiom as dashboard-page.render.test.tsx. `requireInvestor`
// and `getInvestorUiDataSource` are mocked so the async server component can be
// invoked directly.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

import { BackendError } from "@/lib/backend";

// --- Auth: bypass the real session gate (no redirect in the test). ---
vi.mock("@/lib/auth/require-investor", () => ({
  requireInvestor: vi.fn(async () => ({ userId: "test-user", role: "investor" })),
}));

// The page's transitive graph reaches @/lib/db (Prisma) at import time via the
// auth/session module; under Vitest the sqlite adapter mismatches the postgres
// schema. This test exercises the render guard, not the DB — stub it out.
vi.mock("@/lib/db", () => ({ prisma: {} }));

// The page imports its signature stylesheet; Vitest has no PostCSS/Tailwind
// pipeline (and the isolated worktree can't resolve the plugin). Style is
// irrelevant to the render-guard assertions — stub the CSS module to nothing.
vi.mock("../dashboard-signature.css", () => ({}));

// --- Data source: getDashboard() rejects with a BackendError. ---
const { getDashboard, getMining, getBtc, getBtcPageData } = vi.hoisted(() => ({
  getDashboard: vi.fn(),
  getMining: vi.fn(),
  getBtc: vi.fn(),
  getBtcPageData: vi.fn(),
}));

vi.mock("@/features/investor-ui/data-source", () => ({
  getInvestorUiDataSource: () => ({ getDashboard, getMining, getBtc }),
  // preview path (unused here) — a fixture source factory that would not throw.
  getFixtureInvestorUiDataSource: () => ({ getDashboard, getMining, getBtc }),
}));

vi.mock("@/app/(product)/btc/_data/get-btc-page-data", () => ({
  getBtcPageData,
}));

import DashboardPage from "../page";

const BACKEND_ERROR = new BackendError("backend unreachable", {
  status: null,
  code: "network",
  requestId: "test-req-123",
  path: "/api/v1/dashboard",
});

async function renderPage(): Promise<string> {
  // No `?state=` → live path → guarded load → BackendError caught.
  const element = await DashboardPage({ searchParams: Promise.resolve({}) });
  return renderToStaticMarkup(element);
}

describe("dashboard page — backend down (guarded live load)", () => {
  beforeEach(() => {
    getDashboard.mockReset();
    getMining.mockReset();
    getBtc.mockReset();
    getBtcPageData.mockReset();
    getDashboard.mockRejectedValue(BACKEND_ERROR);
    // Even if these resolve, Promise.all rejects on getDashboard first.
    getMining.mockResolvedValue({});
    getBtc.mockResolvedValue({});
    getBtcPageData.mockResolvedValue({});
  });

  it("does not throw — the BackendError is caught, not propagated", async () => {
    await expect(renderPage()).resolves.toBeTypeOf("string");
  });

  it("renders the honest backend-down page-level state", async () => {
    const html = await renderPage();
    expect(html).toContain("Backend source of truth unavailable");
    expect(html).toContain("/api/v1/dashboard unreachable");
    expect(html).toContain("test-req-123");
    // role=alert page-level error surface, not a crash overlay.
    expect(html).toContain('role="alert"');
  });

  it("shows NO fabricated Live badge or live provenance", async () => {
    const html = await renderPage();
    expect(html).not.toContain("Live");
    expect(html).not.toContain("Simulated");
    expect(html).not.toContain("Oracle");
    expect(html).not.toContain("Attested");
  });

  it("substitutes NO fixture data — the honest error is the whole page body", async () => {
    const html = await renderPage();
    // None of the success-path hero copy leaks through.
    expect(html).not.toContain("Current position");
    expect(html).not.toContain("Capital allocated");
    expect(html).not.toContain("Strategy composition");
  });
});
