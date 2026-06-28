import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// ── Prisma mock (before import) ──────────────────────────────────────────────
const findFirst = vi.fn();
const findUnique = vi.fn();
vi.mock("@/lib/db", () => ({
  prisma: {
    projectionStudyRun: { findFirst: (...a: unknown[]) => findFirst(...a) },
    scenarioRun: { findUnique: (...a: unknown[]) => findUnique(...a) },
  },
}));

import { getLatestProjectionStudyRun } from "../latest-study-run";

const BANNER_SRC = readFileSync(
  new URL("../../../components/admin/projection/preview-source-banner.tsx", import.meta.url),
  "utf8",
);
const PAGE_SRC = readFileSync(
  new URL("../../../app/admin/projection/preview/page.tsx", import.meta.url),
  "utf8",
);

beforeEach(() => {
  findFirst.mockReset();
  findUnique.mockReset();
});

describe("getLatestProjectionStudyRun", () => {
  it("Test 1: returns the latest real run with parsed headline", async () => {
    findFirst.mockResolvedValue({
      id: "study_abcdef123456",
      ranAt: new Date("2026-06-20T10:00:00Z"),
      label: "Q3 base case",
      methodologyVersion: "v1.0",
      scenarioRunIds: JSON.stringify(["run_1", "run_2"]),
    });
    findUnique.mockResolvedValue({
      outputs: JSON.stringify({
        apy_range: { low: 8, high: 15 },
        risk_score: 42,
        mode: "balanced",
      }),
      confidence: "medium",
    });

    const r = await getLatestProjectionStudyRun();
    expect(r).not.toBeNull();
    expect(r!.shortId).toBe("study_ab");
    expect(r!.scenarioRunCount).toBe(2);
    expect(r!.apyRange).toEqual({ low: 8, high: 15 });
    expect(r!.riskScore).toBe(42);
    expect(r!.mode).toBe("balanced");
    expect(r!.confidence).toBe("medium");
  });

  it("Test 2: returns null when no run exists (caller → demo fixture)", async () => {
    findFirst.mockResolvedValue(null);
    expect(await getLatestProjectionStudyRun()).toBeNull();
  });

  it("Test 5/6: preserves run even if outputs unparseable (no crash)", async () => {
    findFirst.mockResolvedValue({
      id: "study_x",
      ranAt: new Date("2026-06-21T00:00:00Z"),
      label: null,
      methodologyVersion: "v1.0",
      scenarioRunIds: "not-json",
    });
    const r = await getLatestProjectionStudyRun();
    expect(r).not.toBeNull();
    expect(r!.scenarioRunCount).toBe(0);
    expect(r!.apyRange).toBeNull(); // gracefully null, never fabricated
  });

  it("never throws on DB failure (returns null)", async () => {
    findFirst.mockRejectedValue(new Error("db down"));
    expect(await getLatestProjectionStudyRun()).toBeNull();
  });
});

describe("preview banner — truth wording (source check)", () => {
  it("Test 3: real-run mode shows latest-run source, demo badge only in no-run branch", () => {
    // The "Demo Fixture" badge is rendered inside the `if (!latestRun)` block;
    // the real-run render path shows the latest-run source line instead.
    expect(BANNER_SRC).toContain('<Badge tone="demo">Demo Fixture</Badge>');
    expect(BANNER_SRC).toContain("Source: Latest ProjectionStudyRun");
    // The demo badge sits before the Mode A render (no-run guard returns early).
    const demoIdx = BANNER_SRC.indexOf("Demo Fixture");
    const realIdx = BANNER_SRC.indexOf("Source: Latest ProjectionStudyRun");
    expect(demoIdx).toBeLessThan(realIdx);
  });

  it("Test 4: fixture mode shows Demo + not linked", () => {
    expect(BANNER_SRC).toContain("Demo Fixture");
    expect(BANNER_SRC).toContain("Not linked to current projection");
    expect(BANNER_SRC).toContain("Illustrative only");
  });

  it("Test 7/8: never claims guaranteed/live; surfaces UNAUDITED + ADMIN ONLY", () => {
    expect(BANNER_SRC).toContain("UNAUDITED");
    expect(BANNER_SRC).toContain("CONFIGURED");
    expect(BANNER_SRC).toContain("GO ADMIN ONLY");
    expect(BANNER_SRC).not.toMatch(/\bguaranteed\b/i);
    // No POSITIVE claim rendered to the admin (strip comments + the unaudited
    // tone/badge, which are honest negatives, before checking).
    const rendered = BANNER_SRC
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/unaudited/gi, ""); // the negative tone/badge
    expect(rendered).not.toMatch(/>\s*audited/i);
    expect(rendered).not.toMatch(/investor[ -]ready/i);
  });

  it("Test 9: page picks header per mode (Latest Study Run vs Demo Fixture)", () => {
    expect(PAGE_SRC).toContain("getLatestProjectionStudyRun");
    expect(PAGE_SRC).toContain('latestRun ? "Latest Study Run" : "Demo Fixture"');
  });

  it("Test 10: page renders the source banner above the fixture", () => {
    expect(PAGE_SRC).toContain("PreviewSourceBanner");
    expect(PAGE_SRC).toContain("ProjectionReportPreview");
  });
});
