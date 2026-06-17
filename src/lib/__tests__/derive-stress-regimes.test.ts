import { describe, expect, it } from "vitest";

import { deriveStressRegimes } from "@/lib/constants/vault";
import type { VaultProduct } from "@/lib/data/vaults";

// ---------------------------------------------------------------------------
// Minimal VaultProduct stub — only the fields deriveStressRegimes reads.
// ---------------------------------------------------------------------------
function makeVault(
  apyLow: number,
  apyHigh: number,
  miningBps: number,
  btcBps: number,
  usdcBps: number,
  reserveBps: number,
): VaultProduct {
  return {
    id: "test",
    name: "Test Vault",
    status: "draft",
    apyLow,
    apyHigh,
    targetMiningBps: miningBps,
    targetBtcTacticalBps: btcBps,
    targetUsdcBaseBps: usdcBps,
    targetStableReserveBps: reserveBps,
    // Remaining required fields with placeholder values.
    slug: "test",
    tagline: "",
    description: "",
    minInvestmentUsd: 250000,
    lockupDays: 60,
    distributionFrequency: "monthly",
    riskLevel: "moderate",
    regulatoryFramework: "regD_506c",
    spvJurisdiction: "cayman",
    disclaimers: [],
    strategy: "mining_yield",
    vintageYear: 2024,
    currency: "USDC",
    provenanceBadge: "Estimated",
  } as unknown as VaultProduct;
}

// ---------------------------------------------------------------------------
// HYV-A: Hearst Yield Vault (apyLow=8, apyHigh=15, 6000/1500/1500/1000 bps)
// ---------------------------------------------------------------------------
describe("deriveStressRegimes — HYV-A", () => {
  const vault = makeVault(8, 15, 6000, 1500, 1500, 1000);
  const [bull, bear] = deriveStressRegimes(vault);

  it("returns two regimes: bull then bear", () => {
    expect(bull?.id).toBe("bull");
    expect(bear?.id).toBe("bear");
  });

  it("bull APY is 11.5 – 15.7 (derived from 8–15 spread=7)", () => {
    expect(bull?.apyLow).toBe(11.5);
    expect(bull?.apyHigh).toBe(15.7);
  });

  it("bear APY is 7.3 – 10.1", () => {
    expect(bear?.apyLow).toBe(7.3);
    expect(bear?.apyHigh).toBe(10.1);
  });

  it("bull sleeves sum to 100", () => {
    expect(
      (bull?.miningPct ?? 0) +
        (bull?.btcTacticalPct ?? 0) +
        (bull?.usdcBasePct ?? 0) +
        (bull?.stableReservePct ?? 0),
    ).toBe(100);
  });

  it("bear sleeves sum to 100", () => {
    expect(
      (bear?.miningPct ?? 0) +
        (bear?.btcTacticalPct ?? 0) +
        (bear?.usdcBasePct ?? 0) +
        (bear?.stableReservePct ?? 0),
    ).toBe(100);
  });

  it("no bull sleeve is negative or above 100", () => {
    [bull?.miningPct, bull?.btcTacticalPct, bull?.usdcBasePct, bull?.stableReservePct].forEach(
      (v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      },
    );
  });

  it("no bear sleeve is negative or above 100", () => {
    [bear?.miningPct, bear?.btcTacticalPct, bear?.usdcBasePct, bear?.stableReservePct].forEach(
      (v) => {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      },
    );
  });

  it("bull apyLow <= bull apyHigh", () => {
    expect((bull?.apyLow ?? 0) <= (bull?.apyHigh ?? 0)).toBe(true);
  });

  it("bear apyLow <= bear apyHigh", () => {
    expect((bear?.apyLow ?? 0) <= (bear?.apyHigh ?? 0)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// P1.1 — Low-mining vault: mining=1000bps — bull shift would exceed available.
// ---------------------------------------------------------------------------
describe("deriveStressRegimes — P1.1 low-mining vault (mining=1000bps)", () => {
  const vault = makeVault(6, 12, 1000, 5000, 3000, 1000);
  const [bull, bear] = deriveStressRegimes(vault);

  it("bull mining sleeve is >= 0 (no negative)", () => {
    expect(bull?.miningPct).toBeGreaterThanOrEqual(0);
  });

  it("bull sleeves sum to 100", () => {
    expect(
      (bull?.miningPct ?? 0) +
        (bull?.btcTacticalPct ?? 0) +
        (bull?.usdcBasePct ?? 0) +
        (bull?.stableReservePct ?? 0),
    ).toBe(100);
  });

  it("bear sleeves sum to 100", () => {
    expect(
      (bear?.miningPct ?? 0) +
        (bear?.btcTacticalPct ?? 0) +
        (bear?.usdcBasePct ?? 0) +
        (bear?.stableReservePct ?? 0),
    ).toBe(100);
  });

  it("all sleeves in [0, 100]", () => {
    const all = [bull, bear].flatMap((r) => [
      r?.miningPct,
      r?.btcTacticalPct,
      r?.usdcBasePct,
      r?.stableReservePct,
    ]);
    all.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge: zero BTC — bear shift has nothing to take from BTC.
// ---------------------------------------------------------------------------
describe("deriveStressRegimes — zero-BTC vault", () => {
  const vault = makeVault(4, 8, 7000, 0, 2000, 1000);
  const [bull, bear] = deriveStressRegimes(vault);

  it("bull and bear sleeves both sum to 100", () => {
    for (const r of [bull, bear]) {
      expect(
        (r?.miningPct ?? 0) +
          (r?.btcTacticalPct ?? 0) +
          (r?.usdcBasePct ?? 0) +
          (r?.stableReservePct ?? 0),
      ).toBe(100);
    }
  });

  it("no sleeve is negative or above 100", () => {
    const all = [bull, bear].flatMap((r) => [
      r?.miningPct,
      r?.btcTacticalPct,
      r?.usdcBasePct,
      r?.stableReservePct,
    ]);
    all.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    });
  });
});

// ---------------------------------------------------------------------------
// Edge: zero spread (apyLow === apyHigh) — must not produce apyLow > apyHigh.
// ---------------------------------------------------------------------------
describe("deriveStressRegimes — zero-spread vault", () => {
  const vault = makeVault(5, 5, 5000, 2000, 2000, 1000);
  const [bull, bear] = deriveStressRegimes(vault);

  it("bull apyLow <= bull apyHigh", () => {
    expect((bull?.apyLow ?? 0) <= (bull?.apyHigh ?? 0)).toBe(true);
  });

  it("bear apyLow <= bear apyHigh", () => {
    expect((bear?.apyLow ?? 0) <= (bear?.apyHigh ?? 0)).toBe(true);
  });
});
