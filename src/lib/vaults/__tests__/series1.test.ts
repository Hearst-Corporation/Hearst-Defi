/**
 * series1 — the read boundary that keeps retired v1 product wording out of the
 * investor cockpit. These tests pin the two scrubbers, because the DB columns
 * they defend against (`VaultDeployment.name`, `.disclaimers`) still hold the
 * withdrawn yield-product text on live rows.
 */
import { describe, expect, it } from "vitest";

import {
  SERIES1_DISCLAIMER,
  SERIES1_FULL_NAME,
  SERIES1_NAME,
  SERIES1_NO_RATE_NOTE,
  SERIES1_SERIES,
  formatBps,
  series1DisplayName,
  series1IsOpen,
  series1SafeDisclaimer,
  series1StatusLabel,
  series1TargetPockets,
} from "@/lib/vaults/series1";
import { scanSeries1InvestorWording } from "@/lib/guards/wording-series1";
import type { VaultProduct } from "@/lib/data/vaults";

describe("series1DisplayName", () => {
  it("replaces the retired yield-vault names stored in the DB", () => {
    // These are the exact values seeded on the live row.
    expect(series1DisplayName("Hearst Yield Vault")).toBe(SERIES1_SERIES);
    expect(series1DisplayName("Yield Vault")).toBe(SERIES1_SERIES);
    expect(series1DisplayName("Mining Yield")).toBe(SERIES1_SERIES);
  });

  it("is case- and spacing-insensitive", () => {
    expect(series1DisplayName("HEARST  YIELD   VAULT")).toBe(SERIES1_SERIES);
    expect(series1DisplayName("hearst yieldvault")).toBe(SERIES1_SERIES);
  });

  it("falls back for missing or blank names", () => {
    expect(series1DisplayName(null)).toBe(SERIES1_SERIES);
    expect(series1DisplayName(undefined)).toBe(SERIES1_SERIES);
    expect(series1DisplayName("   ")).toBe(SERIES1_SERIES);
  });

  it("preserves a legitimate stored name", () => {
    expect(series1DisplayName("Hearst Bitcoin Reserve Vault")).toBe(
      "Hearst Bitcoin Reserve Vault",
    );
  });
});

describe("series1SafeDisclaimer", () => {
  it("suppresses the retired distribution promise stored on the live row", () => {
    expect(
      series1SafeDisclaimer(
        "Balanced sleeve mix; mining is the dominant yield source. Monthly USDC distributions, 60-day soft lock-up (class A).",
      ),
    ).toBeNull();
  });

  it("suppresses any disclaimer quoting a rate", () => {
    expect(series1SafeDisclaimer("Target APY 8-15%, not guaranteed.")).toBeNull();
    expect(series1SafeDisclaimer("Monthly distribution schedule applies.")).toBeNull();
  });

  it("keeps a clean disclaimer", () => {
    const clean =
      "Past performance is not indicative of future results. Capital at risk.";
    expect(series1SafeDisclaimer(clean)).toBe(clean);
  });

  it("returns null for missing input", () => {
    expect(series1SafeDisclaimer(null)).toBeNull();
    expect(series1SafeDisclaimer("  ")).toBeNull();
  });
});

describe("series1 status", () => {
  it("only reports open for a live vault", () => {
    expect(series1IsOpen("live")).toBe(true);
    for (const s of ["draft", "review", "paused", "closed"] as const) {
      expect(series1IsOpen(s)).toBe(false);
    }
  });

  it("never labels a non-live vault as open", () => {
    for (const s of ["draft", "review", "paused", "closed"] as const) {
      expect(series1StatusLabel(s).toLowerCase()).not.toContain("open ·");
    }
    expect(series1StatusLabel("live")).toContain("Open");
  });
});

describe("series1TargetPockets", () => {
  const vault = {
    targetMiningBps: 4000,
    targetBtcTacticalBps: 2700,
    targetStableReserveBps: 2000,
    targetUsdcBaseBps: 1300,
  } as VaultProduct;

  it("folds the stable + USDC legs into a single B3 operating reserve", () => {
    const pockets = series1TargetPockets(vault);
    expect(pockets.map((p) => p.code)).toEqual(["B1", "B2", "B3"]);
    expect(pockets[2]?.targetBps).toBe(3300);
  });

  it("reproduces the 40/27/33 on-chain split", () => {
    const pockets = series1TargetPockets(vault);
    expect(pockets.map((p) => formatBps(p.targetBps))).toEqual(["40%", "27%", "33%"]);
    expect(pockets.reduce((s, p) => s + p.targetBps, 0)).toBe(10_000);
  });
});

describe("formatBps", () => {
  it("drops decimals only for whole percentages", () => {
    expect(formatBps(4000)).toBe("40%");
    expect(formatBps(2750)).toBe("27.5%");
  });
});

describe("Series 1 constants are themselves compliant", () => {
  // The module is the source of investor-facing copy — if IT carries banned
  // wording, every surface inherits it.
  it.each([
    ["SERIES1_NAME", SERIES1_NAME],
    ["SERIES1_FULL_NAME", SERIES1_FULL_NAME],
    ["SERIES1_NO_RATE_NOTE", SERIES1_NO_RATE_NOTE],
    ["SERIES1_DISCLAIMER", SERIES1_DISCLAIMER],
  ])("%s carries no banned wording", (_label, copy) => {
    const result = scanSeries1InvestorWording(copy);
    expect(result.hits.map((h) => h.match)).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("never names the retired product", () => {
    expect(SERIES1_FULL_NAME).not.toMatch(/yield/i);
    expect(series1DisplayName(SERIES1_NAME)).toBe(SERIES1_NAME);
  });
});
