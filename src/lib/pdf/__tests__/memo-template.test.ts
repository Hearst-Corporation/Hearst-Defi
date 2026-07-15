import { describe, expect, it } from "vitest";

import type { MiningOpsSnapshot, VaultMonthlyRow } from "@/lib/pdf/memo-data";
import { getMockMemoInput } from "./memo-input.fixture";
import { formatApyRange, periodFromIso } from "@/lib/pdf/memo-data";

const miningOps: MiningOpsSnapshot = {
  hashrate_ph_s: 182,
  uptime_pct: 98.4,
  margin_score: 64,
  attestations_count: 1,
};

// v3.0 note: rows carry NAV + APY range only; there is no periodic cash
// distribution, so no `distribution_usdc`/`apy_achieved` field. `is_synthetic`
// marks fabricated pad rows (badged `estimated`); these fixture rows are real.
const monthlyHistory: VaultMonthlyRow[] = [
  {
    period: "2025-10",
    apy_low: 9.0,
    apy_high: 12.5,
    nav_usdc: 24_200_000,
    is_synthetic: false,
  },
  {
    period: "2025-11",
    apy_low: 9.2,
    apy_high: 12.6,
    nav_usdc: 24_400_000,
    is_synthetic: false,
  },
  {
    period: "2025-12",
    apy_low: 9.3,
    apy_high: 12.7,
    nav_usdc: 24_550_000,
    is_synthetic: false,
  },
  {
    period: "2026-01",
    apy_low: 9.4,
    apy_high: 12.8,
    nav_usdc: 24_700_000,
    is_synthetic: false,
  },
];

// Forbidden words in any investor-facing output (CLAUDE.md non-negotiable #5).
const FORBIDDEN_WORDS = [
  "guarantee",
  "promise",
  "certain",
  "will deliver",
  "risk-free",
];

describe("MemoDocument PDF rendering", () => {
  it("renders the 7-page investor memo to a non-trivial PDF buffer", async () => {
    // Dynamic imports keep react-pdf out of the module graph for the other
    // tests in this repo and make sure the smoke test only runs when this
    // file is collected.
    const { renderToBuffer } = await import("@react-pdf/renderer");
    const { MemoDocument } = await import("@/lib/pdf/memo-template");

    const input = getMockMemoInput();
    const generatedAt = "2026-01-15T00:00:00.000Z";
    const period = periodFromIso(generatedAt);

    const buf = await renderToBuffer(
      MemoDocument({
        data: {
          input,
          memo: null,
          generatedAt,
          period,
          miningOps,
          monthlyHistory,
        },
      }),
    );

    // Sanity: it's a real PDF (starts with %PDF-) and is at least 10kB.
    expect(buf.length).toBeGreaterThan(10_000);
    expect(buf.subarray(0, 5).toString("ascii")).toBe("%PDF-");
  }, 30_000);

  it("prints the headline APY as a range and never a forbidden word", () => {
    const input = getMockMemoInput();

    // The memo headline (cover + executive summary) prints exactly this string
    // via `formatApyRange(input.vault.apyRange)`. Non-negotiable #1: APY is
    // ALWAYS a canonical en-dash range, never a single point. With the fixture
    // aligned to the vault's own 8-15% mandate preset this is "8.0–15.0%".
    const headline = formatApyRange(input.vault.apyRange);
    expect(headline).toMatch(/^\d+(\.\d+)?–\d+(\.\d+)?%$/);
    expect(headline).toContain("–"); // en-dash separator, not a hyphen
    expect(headline).not.toMatch(/^\d+(\.\d+)?%$/); // reject a single-point value
    expect(input.vault.apyRange.low).toBeLessThan(input.vault.apyRange.high);

    // Non-negotiable #5: no forbidden word in any investor-facing figure.
    const lower = headline.toLowerCase();
    for (const word of FORBIDDEN_WORDS) {
      expect(lower).not.toContain(word);
    }
  });
});
