import { describe, expect, it } from "vitest";

import {
  constructionDraftToVaultForm,
  encodeVaultFormPrefill,
  decodeVaultFormPrefill,
} from "@/lib/agentic/swarm/live/to-vault-form";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";

function draft(
  over: Partial<ProductConstructionDraft> = {},
): ProductConstructionDraft {
  return {
    objective: "BTC yield vault",
    vault: { ticker: "HYV", label: "Hearst Yield Vault" },
    telegram: { configured: true, machineCount: 57 },
    market: { btcUsd: 60000, hashpriceUsdPerThDay: 0.05, defiApyMedianPct: 10 },
    strategy: {
      configured: true,
      miningYieldPct: 14,
      usdcYieldPct: 6,
      usdcSource: "aave",
      btcReturn: { bear: -20, base: 10, bull: 40 },
      headlineApy: { low: 9.4, high: 12.8 },
      assumptions: ["a1", "a2", "a3", "a4", "a5"],
      disclaimer: "not guaranteed",
      companyLevers: {
        source: "config",
        status: "CONFIGURED",
        markupPct: 25,
        revenueSharePct: 20,
        borrowAprPct: 6,
        feePct: 2,
        energyCostUsdPerKwh: 0.06,
      },
      provenance: "Live",
    },
    quant: {
      seed: 1,
      paths: 5000,
      horizonMonths: 12,
      percentiles: { p5: 0.06, p25: 0.094, p50: 0.111, p75: 0.128, p95: 0.16 },
      headlineRange: { low: 0.094, high: 0.128 },
      probBelowFloorPct: 8,
      floorApyPct: 8,
      provenance: "Live",
    },
    assumptions: {
      paths: 5000,
      horizonMonths: 12,
      floorApyPct: 8,
      btc: { annualDrift: 0.1, annualVol: 0.6 },
      difficulty: {
        reversionSpeed: 0.8,
        longRunMultiple: 1.15,
        annualVol: 0.25,
        minMultiple: 0.6,
        maxMultiple: 2.0,
      },
      yield: { miningWeight: 0.6, stableApyVol: 0.01 },
      amortizationMonths: 24,
      btcDifficultyCorrelation: 0.4,
    },
    charts: [],
    writeup: { title: "t", prose: "p", llmAuthored: false, provenance: "Live" },
    audit: [],
    safe: true,
    disclaimer: "not guaranteed",
    mode: "live_read",
    effects: {
      externalSend: false,
      deployed: false,
      markedLive: false,
      custodialWrite: false,
    },
    ...over,
  };
}

describe("constructionDraftToVaultForm", () => {
  it("maps the headline range to APY bps (low < high), never a single point", () => {
    const f = constructionDraftToVaultForm(draft());
    expect(f.targetApyLowBps).toBe(940);
    expect(f.targetApyHighBps).toBe(1280);
    expect(f.targetApyHighBps).toBeGreaterThan(f.targetApyLowBps);
  });

  it("allocations always sum to exactly 10000 bps", () => {
    const f = constructionDraftToVaultForm(draft());
    const sum =
      f.targetMiningBps +
      f.targetBtcTacticalBps +
      f.targetUsdcBaseBps +
      f.targetStableReserveBps;
    expect(sum).toBe(10_000);
  });

  it("a collapsed/negative MC range still yields high > low", () => {
    const f = constructionDraftToVaultForm(
      draft({
        quant: {
          ...draft().quant,
          headlineRange: { low: -0.13, high: -0.06 },
        },
      }),
    );
    expect(f.targetApyHighBps).toBeGreaterThan(f.targetApyLowBps);
    // negative low clamps to 0
    expect(f.targetApyLowBps).toBe(0);
  });

  it("infers the strategy from the vault ticker", () => {
    expect(constructionDraftToVaultForm(draft()).strategy).toBe("mining_yield");
    expect(
      constructionDraftToVaultForm(
        draft({ vault: { ticker: "HBP", label: "BTC Plus" } }),
      ).strategy,
    ).toBe("btc_tactical");
  });

  it("carries the construction provenance into the disclaimers", () => {
    const f = constructionDraftToVaultForm(draft());
    expect(f.disclaimers[0]).toMatch(/live-read product-construction/i);
    expect(f.disclaimers.length).toBeLessThanOrEqual(5);
  });
});

describe("encode/decode roundtrip", () => {
  it("roundtrips a prefill through the URL encoding", () => {
    const f = constructionDraftToVaultForm(draft());
    const decoded = decodeVaultFormPrefill(encodeVaultFormPrefill(f));
    expect(decoded?.ticker).toBe(f.ticker);
    expect(decoded?.targetApyLowBps).toBe(f.targetApyLowBps);
    expect(decoded?.targetMiningBps).toBe(f.targetMiningBps);
    expect(decoded?.strategy).toBe(f.strategy);
  });

  it("returns null on garbage / empty", () => {
    expect(decodeVaultFormPrefill(null)).toBeNull();
    expect(decodeVaultFormPrefill("")).toBeNull();
    expect(decodeVaultFormPrefill("!!!not-base64!!!")).toBeNull();
  });

  it("whitelists fields — a crafted param cannot inject arbitrary keys", () => {
    const malicious = Buffer.from(
      JSON.stringify({ ticker: "X", evil: "drop table", __proto__: {} }),
      "utf-8",
    ).toString("base64");
    const decoded = decodeVaultFormPrefill(malicious);
    expect(decoded).not.toBeNull();
    expect((decoded as Record<string, unknown>).evil).toBeUndefined();
    expect(decoded?.ticker).toBe("X");
  });
});
