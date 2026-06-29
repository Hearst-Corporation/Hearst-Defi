import { describe, expect, it } from "vitest";

import {
  STAGE_ORDER,
  buildConstructionTimeline,
  buildTimelineFromDraft,
  canRenderPerformanceEngines,
  canRenderAllocation,
  canRenderSafeScenario,
  canRenderProductSummary,
  stageById,
  type ConstructionSignals,
  type SignalState,
} from "@/lib/agentic/swarm/live/construction-timeline";
import {
  resolveProductIdentity,
  isBtcMiningObjective,
  enforceProductMiningFloor,
  buildCanonicalAllocation,
  assertCanonicalFloor,
  BTC_MINING_PRODUCT_ID,
} from "@/lib/products/canonical-allocation";
import { buildEconomicsViews } from "@/lib/products/economics-views";
import { formatTargetsSafely } from "@/lib/products/guards";
import { BTC_MINING_PERFORMANCE_VAULT } from "@/lib/products/btc-mining-performance-vault";
import { constructionDraftToVaultForm } from "@/lib/agentic/swarm/live/to-vault-form";
import { containsForbidden } from "@/lib/agents/forbidden-words";
import { makeSyntheticDraft } from "@/lib/admin/diagnostics/btc-product-construction-diagnostics";

const READY: SignalState = { present: true, provenance: "LIVE" };
function allReady(): ConstructionSignals {
  return {
    btcMarket: READY,
    hashprice: READY,
    btcYield: { present: true, provenance: "CONFIGURED" },
    usdcYield: READY,
    machineEconomics: { present: true, provenance: "ATTESTED" },
    scenarioEngine: { present: true, provenance: "ESTIMATED" },
    writeup: { present: true, provenance: "CONFIGURED" },
  };
}

// ── deterministic sequenced reveal (PROMPT §17) ──────────────────────────────

describe("construction timeline — deterministic render order", () => {
  it("parallel swarm results can arrive out of order but render order stays fixed", () => {
    const a = buildConstructionTimeline(allReady());
    // "Out of order": btc + scenarios not ready yet, hashprice/usdc are.
    const b = buildConstructionTimeline({
      ...allReady(),
      btcMarket: { present: false, provenance: "UNKNOWN" },
      scenarioEngine: { present: false, provenance: "UNKNOWN" },
    });
    expect(a.stages.map((s) => s.id)).toEqual([...STAGE_ORDER]);
    expect(b.stages.map((s) => s.id)).toEqual([...STAGE_ORDER]);
  });

  it("BTC market block renders first, hashprice second", () => {
    expect(STAGE_ORDER[0]).toBe("btc-market");
    expect(STAGE_ORDER[1]).toBe("hashprice");
    const t = buildConstructionTimeline(allReady());
    expect(t.stages[0]!.id).toBe("btc-market");
    expect(t.stages[1]!.id).toBe("hashprice");
  });

  it("Safe scenario renders before Balanced and Opportunistic", () => {
    const order = [...STAGE_ORDER] as string[];
    expect(order.indexOf("safe-scenario")).toBeLessThan(order.indexOf("balanced-scenario"));
    expect(order.indexOf("balanced-scenario")).toBeLessThan(order.indexOf("opportunistic-scenario"));
  });

  it("product summary is the last visible product block", () => {
    expect(STAGE_ORDER[STAGE_ORDER.length - 1]).toBe("product-summary");
  });

  it("deterministic: same signals → same timeline", () => {
    expect(buildConstructionTimeline(allReady())).toEqual(buildConstructionTimeline(allReady()));
  });
});

describe("dependency gates", () => {
  it("performance engines waits for BTC market + hashprice + USDC yield", () => {
    expect(canRenderPerformanceEngines(buildConstructionTimeline(allReady()))).toBe(true);
    const missingBtc = buildConstructionTimeline({
      ...allReady(),
      btcMarket: { present: false, provenance: "UNKNOWN" },
    });
    expect(canRenderPerformanceEngines(missingBtc)).toBe(false);
    // The performance-engines stage itself is gated to "waiting".
    expect(stageById(missingBtc, "performance-engines")!.status).toBe("waiting");
  });

  it("allocation waits for performance engines", () => {
    const noEngines = buildConstructionTimeline({
      ...allReady(),
      hashprice: { present: false, provenance: "UNKNOWN" },
    });
    expect(canRenderPerformanceEngines(noEngines)).toBe(false);
    expect(canRenderAllocation(noEngines)).toBe(false);
  });

  it("safe scenario waits for allocation; summary waits for all three scenarios", () => {
    const t = buildTimelineFromDraft(makeSyntheticDraft());
    expect(canRenderAllocation(t)).toBe(true);
    expect(canRenderSafeScenario(t)).toBe(true);
    expect(canRenderProductSummary(t)).toBe(true);
    // Without the scenario engine, the allocation + safe gates close.
    const noScenarios = buildConstructionTimeline({
      ...allReady(),
      scenarioEngine: { present: false, provenance: "UNKNOWN" },
    });
    expect(canRenderAllocation(noScenarios)).toBe(false);
    expect(canRenderSafeScenario(noScenarios)).toBe(false);
  });
});

// ── one canonical allocation (PROMPT §8, §12.B) ──────────────────────────────

describe("canonical allocation — single source of truth", () => {
  it("canonical allocation is shared by summary / scenarios / writeup / wizard", () => {
    const draft = makeSyntheticDraft();
    const ca = draft.canonicalAllocation!;
    const balanced = draft.scenarios!.find((s) => s.regime === "balanced")!;
    // scenarios ↔ canonical
    expect(ca.mining).toBeCloseTo(balanced.allocation.mining, 1);
    expect(ca.btcHoldingCollateral).toBeCloseTo(balanced.allocation.btc, 1);
    // wizard prefill ↔ canonical
    const form = constructionDraftToVaultForm(draft);
    expect(form.targetMiningBps).toBe(Math.round(ca.mining * 100));
    expect(form.targetBtcTacticalBps).toBe(Math.round(ca.btcHoldingCollateral * 100));
    const sum =
      form.targetMiningBps +
      form.targetBtcTacticalBps +
      form.targetUsdcBaseBps +
      form.targetStableReserveBps;
    expect(sum).toBe(10_000);
    // writeup ↔ canonical
    const miningStr = `${Math.round(ca.mining * 10) / 10}%`;
    expect(draft.writeup.prose).toContain(`mining ${miningStr}`);
  });

  it("raw mining 2.92% is rejected for the BTC Mining product", () => {
    const d = enforceProductMiningFloor(2.92, BTC_MINING_PRODUCT_ID);
    expect(d.rejected).toBe(true);
    expect(d.miningFractionCanonical).toBeCloseTo(0.3, 9);
    expect(d.governanceException).toBe(true);
  });

  it("normal mining floor is >= 30% even when mining is underwater", () => {
    const draft = makeSyntheticDraft({ miningYieldPct: -3, usdcYieldPct: 9 });
    const ca = draft.canonicalAllocation!;
    expect(ca.mining).toBeGreaterThanOrEqual(30);
    expect(assertCanonicalFloor(ca)).toEqual([]);
    // the raw sub-floor output is kept ONLY in the rejected debug field
    expect(ca.rawRejected).not.toBeNull();
    expect(ca.rawRejected!.mining).toBeLessThan(30);
  });

  it("non-mining product carries no floor (raw weight passes through)", () => {
    const d = enforceProductMiningFloor(2.92, "vault:HYV");
    expect(d.rejected).toBe(false);
    expect(d.miningFractionCanonical).toBeCloseTo(0.0292, 6);
  });

  it("buildCanonicalAllocation: enforced sleeves are returned verbatim, raw rejected when sub-floor", () => {
    const ca = buildCanonicalAllocation({
      productId: BTC_MINING_PRODUCT_ID,
      productName: "BTC Mining Performance Vault",
      enforced: {
        mining: 30,
        btcHoldingCollateral: 50,
        stableReserve: 12,
        yieldOverlay: 8,
        miningFraction: 0.3,
        governanceException: true,
        provenance: "Live",
      },
      raw: { mining: 2.92, btcHoldingCollateral: 14.58, stableReserve: 0, yieldOverlay: 82.5 },
    });
    expect(ca.mining).toBe(30);
    expect(ca.rawRejected).not.toBeNull();
    expect(ca.rawRejected!.mining).toBe(2.92);
  });
});

// ── product identity (PROMPT §12.A) ──────────────────────────────────────────

describe("product identity", () => {
  it("product name is BTC Mining Performance Vault for a mining objective", () => {
    for (const obj of [
      "Construis le BTC Mining Performance Vault",
      "Je veux construire un BTC mining vault",
      "build a bitcoin mining vault",
      "create a vault around hashprice and miners",
    ]) {
      expect(isBtcMiningObjective(obj)).toBe(true);
      const id = resolveProductIdentity(obj);
      expect(id?.name).toBe("BTC Mining Performance Vault");
      expect(id?.id).toBe(BTC_MINING_PRODUCT_ID);
    }
  });

  it("non-mining objective falls back to the generic vault (null identity)", () => {
    expect(resolveProductIdentity("a generic stable yield product")).toBeNull();
    const draft = makeSyntheticDraft();
    expect(draft.vault.label).toBe("BTC Mining Performance Vault");
    expect(draft.vault.label).not.toBe("Hearst Yield Vault");
  });
});

// ── targets never additive (PROMPT §9, §12) ──────────────────────────────────

describe("targets — 8–12% and 20–24% are not additive", () => {
  it("distribution + total are separate inclusive layers, never summed", () => {
    const t = formatTargetsSafely(BTC_MINING_PERFORMANCE_VAULT);
    const summedRe = /\d+\s*%\s*\+\s*\d+\s*%/;
    expect(summedRe.test(t.distribution)).toBe(false);
    expect(summedRe.test(t.total)).toBe(false);
    expect(t.total).toContain("inclusive");
    expect(t.distribution).not.toBe(t.total);
    // The hero/summary string must never present "8–12% + 20–24%".
    expect(`${t.distribution} ${t.total}`).not.toMatch(summedRe);
  });
});

// ── economics views / bug candidate (PROMPT §12.D) ───────────────────────────

describe("economics views — negative-APY transparency", () => {
  it("adjusted APY negative despite positive stable fallback → bug candidate", () => {
    const e = buildEconomicsViews({
      miningYieldPct: -3,
      usdcYieldPct: 9,
      btcBaseReturnPct: 40,
      borrowAprPct: 6,
      feePct: 2,
      rawMiningWeight: 0.029,
      adjustedMiningWeight: 0.3,
    });
    // Force an adjusted negative by a heavy borrow+fee drag; assert the flag logic.
    const eNeg = buildEconomicsViews({
      miningYieldPct: -20,
      usdcYieldPct: 4,
      btcBaseReturnPct: 0,
      borrowAprPct: 6,
      feePct: 2,
      rawMiningWeight: 0.6,
      adjustedMiningWeight: 0.6,
    });
    expect(eNeg.adjusted.blendedApyPct).toBeLessThan(0);
    expect(eNeg.bugCandidate).toBe(true);
    expect(eNeg.factors.some((f) => f.includes("BUG CANDIDATE"))).toBe(true);
    // healthy case is not a bug candidate
    expect(e.bugCandidate).toBe(e.adjusted.blendedApyPct < 0 && 9 > 0);
  });

  it("raw vs adjusted use the supplied weights", () => {
    const e = buildEconomicsViews({
      miningYieldPct: 10,
      usdcYieldPct: 9,
      btcBaseReturnPct: 40,
      borrowAprPct: 6,
      feePct: 2,
      rawMiningWeight: 0.05,
      adjustedMiningWeight: 0.3,
    });
    expect(e.raw.miningWeight).toBe(0.05);
    expect(e.adjusted.miningWeight).toBe(0.3);
  });
});

// ── honesty + read-only (PROMPT §17) ─────────────────────────────────────────

describe("honesty + read-only", () => {
  it("no guaranteed language in the construction write-up", () => {
    const draft = makeSyntheticDraft();
    expect(containsForbidden(draft.writeup.prose)).toBeNull();
  });

  it("no DB writes / send / deploy — effects all false, mode live_read", () => {
    const draft = makeSyntheticDraft();
    expect(draft.effects).toEqual({
      externalSend: false,
      deployed: false,
      markedLive: false,
      custodialWrite: false,
    });
    expect(draft.mode).toBe("live_read");
  });
});
