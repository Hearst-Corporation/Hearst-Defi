import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

// ── Mocks for the data loaders (before import) ───────────────────────────────
const fetchBtcPrice = vi.fn();
const fetchHashprice = vi.fn();
const fetchDefiLlama = vi.fn();
vi.mock("@/lib/data/btc-price", () => ({ fetchBtcPrice: (...a: unknown[]) => fetchBtcPrice(...a) }));
vi.mock("@/lib/data/hashprice", () => ({ fetchHashprice: (...a: unknown[]) => fetchHashprice(...a) }));
vi.mock("@/lib/data/defillama", () => ({ fetchDefiLlama: (...a: unknown[]) => fetchDefiLlama(...a) }));

import { loadSourceTruthSummary } from "../source-truth-summary";

const BADGE_SRC = readFileSync(
  new URL("../../../components/admin/projection/source-truth-badge.tsx", import.meta.url),
  "utf8",
);

function row(summary: Awaited<ReturnType<typeof loadSourceTruthSummary>>, label: string) {
  return summary.rows.find((r) => r.label === label);
}

beforeEach(() => {
  fetchBtcPrice.mockReset();
  fetchHashprice.mockReset();
  fetchDefiLlama.mockReset();
});

describe("loadSourceTruthSummary", () => {
  it("Test 1: live BTC/hashprice/usdc → LIVE badges", async () => {
    fetchBtcPrice.mockResolvedValue({ usd: 60000, stale: false });
    fetchHashprice.mockResolvedValue({ usd_per_th_day: 0.028, stale: false });
    fetchDefiLlama.mockResolvedValue({ source: "live", stale: false, apyMedianPct: 5.1 });

    const s = await loadSourceTruthSummary();
    expect(row(s, "BTC price")!.status).toBe("LIVE");
    expect(row(s, "Hashprice")!.status).toBe("LIVE");
    expect(row(s, "Stable yield (USDC)")!.status).toBe("LIVE");
  });

  it("Test 2: stale/fallback sources → FALLBACK with reason", async () => {
    fetchBtcPrice.mockResolvedValue({ usd: 0, stale: true });
    fetchHashprice.mockResolvedValue({ usd_per_th_day: 0.055, stale: true });
    fetchDefiLlama.mockResolvedValue({ source: "fallback", stale: true, apyMedianPct: 4.5 });

    const s = await loadSourceTruthSummary();
    expect(row(s, "BTC price")!.status).toBe("FALLBACK");
    expect(row(s, "Hashprice")!.status).toBe("FALLBACK");
    expect(row(s, "Stable yield (USDC)")!.status).toBe("FALLBACK");
    expect(row(s, "Stable yield (USDC)")!.reason).toBeTruthy();
  });

  it("Test 3: company assumptions → CONFIGURED", async () => {
    primeLive();
    const s = await loadSourceTruthSummary();
    expect(row(s, "Company assumptions")!.status).toBe("CONFIGURED");
    expect(row(s, "Risk references")!.status).toBe("CONFIGURED");
  });

  it("Test 4: smart-contract/counterparty → UNAUDITED", async () => {
    primeLive();
    const s = await loadSourceTruthSummary();
    expect(row(s, "Smart-contract risk")!.status).toBe("UNAUDITED");
    expect(row(s, "Counterparty risk")!.status).toBe("UNAUDITED");
  });

  it("Test 5: vol index is MOCK, never LIVE", async () => {
    primeLive();
    const s = await loadSourceTruthSummary();
    expect(row(s, "Vol index")!.status).toBe("MOCK");
    expect(row(s, "Vol index")!.status).not.toBe("LIVE");
  });

  it("Test 6: counts tally the statuses", async () => {
    fetchBtcPrice.mockResolvedValue({ usd: 60000, stale: false });
    fetchHashprice.mockResolvedValue({ usd_per_th_day: 0.028, stale: false });
    fetchDefiLlama.mockResolvedValue({ source: "live", stale: false, apyMedianPct: 5.1 });
    const s = await loadSourceTruthSummary();
    expect(s.counts.LIVE).toBe(3);
    expect(s.counts.UNAUDITED).toBe(2);
    expect(s.counts.CONFIGURED).toBeGreaterThanOrEqual(3);
    expect(s.counts.MOCK).toBe(1);
  });

  it("Test 7: verdict is GO ADMIN ONLY, overall MIXED", async () => {
    primeLive();
    const s = await loadSourceTruthSummary();
    expect(s.verdict).toBe("GO ADMIN ONLY");
    expect(s.overall).toBe("MIXED");
  });

  it("Test 9: fallback rows carry a reason", async () => {
    fetchBtcPrice.mockRejectedValue(new Error("down"));
    fetchHashprice.mockRejectedValue(new Error("down"));
    fetchDefiLlama.mockRejectedValue(new Error("down"));
    const s = await loadSourceTruthSummary();
    expect(row(s, "BTC price")!.status).toBe("FALLBACK");
    expect(row(s, "BTC price")!.reason).toBeTruthy();
  });

  it("Test 10: APY range output is MIXED (live + configured)", async () => {
    primeLive();
    const s = await loadSourceTruthSummary();
    expect(row(s, "APY range")!.status).toBe("MIXED");
  });

  function primeLive() {
    fetchBtcPrice.mockResolvedValue({ usd: 60000, stale: false });
    fetchHashprice.mockResolvedValue({ usd_per_th_day: 0.028, stale: false });
    fetchDefiLlama.mockResolvedValue({ source: "live", stale: false, apyMedianPct: 5.1 });
  }
});

describe("badge component — wording guard", () => {
  it("Test 8: no forbidden POSITIVE wording in the badge/summary component", () => {
    // "Not guaranteed" is allowed (a negation); a positive "guaranteed" claim is not.
    // Strip the allowed negation (across the JSX line wrap) before checking.
    const noNegation = BADGE_SRC.replace(/not\s+guaranteed/gi, "");
    expect(noNegation).not.toMatch(/\bguaranteed\b/i);
    expect(BADGE_SRC).not.toMatch(/investor[ -]ready/i);
    expect(BADGE_SRC).not.toMatch(/\bpromised\b/i);
    expect(BADGE_SRC).not.toMatch(/safe return/i);
    // Verdict is rendered from the summary prop (which is always GO ADMIN ONLY).
    expect(BADGE_SRC).toContain("summary.verdict");
    // "Not guaranteed" may wrap across JSX lines — match tolerant of whitespace.
    expect(BADGE_SRC).toMatch(/not\s+guaranteed/i);
    expect(BADGE_SRC).toContain("Admin validation required");
  });

  it("renders a tone for every status incl. LIVE/FALLBACK/MOCK distinctly", () => {
    expect(BADGE_SRC).toContain("LIVE:");
    expect(BADGE_SRC).toContain("FALLBACK:");
    expect(BADGE_SRC).toContain("MOCK:");
    expect(BADGE_SRC).toContain("UNAUDITED:");
  });
});
