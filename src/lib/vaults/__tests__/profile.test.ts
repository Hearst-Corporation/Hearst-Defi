import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// profile.ts no longer imports from resolver.ts — the Prisma db mock is not
// strictly required here, but we keep server-only stubbed in case any
// transitive dependency (e.g. @prisma/client runtime checks) triggers it in
// the vitest node environment.
vi.mock("server-only", () => ({}));

import { toVaultProfile } from "@/lib/vaults/profile";
import {
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
} from "@/lib/engine/vaults";
import type { VaultDeployment } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helper: build a minimal VaultDeployment row for a given strategy.
// All Decimal fields are constructed with `new Prisma.Decimal(N)` — only .toNumber()
// is consumed in profile.ts, matching the real Prisma runtime behaviour.
// ---------------------------------------------------------------------------

function makeDeployment(
  strategy: "mining_yield" | "btc_tactical" | "stable_reserve",
  overrides: Partial<VaultDeployment> = {},
): VaultDeployment {
  return {
    id: "cmx_test_deploy_001",
    ticker: "HYV-A",
    name: "Hearst Yield Vault — Series A",
    description: "Custom managed deployment",
    strategy,
    colorTag: "accent",
    status: "live",
    minTicketUsdc: new Prisma.Decimal(250_000),
    capacityUsdc: new Prisma.Decimal(10_000_000),
    mgmtFeeBps: 100,
    perfFeeBps: 1_000,
    hurdleBps: 0,
    softLockupDays: 60,
    targetApyLowBps: 800,
    targetApyHighBps: 1_500,
    spvJurisdiction: "cayman",
    shareClass: "A",
    regExemption: "regD_506c",
    disclaimers: "Not an offer of securities.",
    targetMiningBps: 6_000,
    targetBtcTacticalBps: 2_500,
    targetUsdcBaseBps: 1_000,
    targetStableReserveBps: 500,
    network: null,
    contractAddress: null,
    requiredSigners: 2,
    signersWhitelist: JSON.stringify([]),
    createdAt: new Date("2026-05-26T00:00:00Z"),
    updatedAt: new Date("2026-05-26T00:00:00Z"),
    submittedAt: null,
    deployedAt: null,
    pausedAt: null,
    closedAt: null,
    createdBy: "admin",
    seededFromStudyId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: 1-to-1 cast
// ---------------------------------------------------------------------------

describe("toVaultProfile — fixture refs", () => {
  it("yield: id and ticker preserved 1:1", () => {
    const profile = toVaultProfile({ kind: "fixture", fixture: VAULT_YIELD });
    expect(profile.id).toBe("yield");
    expect(profile.ticker).toBe("HYV");
  });

  it("yield: apyTarget preserved exactly", () => {
    const profile = toVaultProfile({ kind: "fixture", fixture: VAULT_YIELD });
    expect(profile.apyTarget.low).toBe(VAULT_YIELD.apyTarget.low);
    expect(profile.apyTarget.high).toBe(VAULT_YIELD.apyTarget.high);
  });

  it("yield: allocationTargets sum ≈ 100", () => {
    const profile = toVaultProfile({ kind: "fixture", fixture: VAULT_YIELD });
    const t = profile.allocationTargets;
    const sum = t.mining + t.btc_tactical + t.usdc_base + t.stable_reserve;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
  });

  it("yield: allocations match source fixture exactly", () => {
    const profile = toVaultProfile({ kind: "fixture", fixture: VAULT_YIELD });
    expect(profile.allocationTargets).toEqual(VAULT_YIELD.allocationTargets);
  });

  it("defensive: id and apyTarget preserved", () => {
    const profile = toVaultProfile({
      kind: "fixture",
      fixture: VAULT_DEFENSIVE,
    });
    expect(profile.id).toBe("defensive");
    expect(profile.ticker).toBe("HDV");
    expect(profile.apyTarget).toEqual(VAULT_DEFENSIVE.apyTarget);
  });

  it("btc-plus: id and apyTarget preserved", () => {
    const profile = toVaultProfile({
      kind: "fixture",
      fixture: VAULT_BTC_PLUS,
    });
    expect(profile.id).toBe("btc-plus");
    expect(profile.ticker).toBe("HBP");
    expect(profile.apyTarget).toEqual(VAULT_BTC_PLUS.apyTarget);
  });
});

// ---------------------------------------------------------------------------
// Deployments: mapping rules
// ---------------------------------------------------------------------------

describe("toVaultProfile — deployment refs (mining_yield)", () => {
  const deployment = makeDeployment("mining_yield");
  const profile = toVaultProfile({ kind: "deployment", deployment });

  it("baseMode === 'balanced'", () => {
    expect(profile.baseMode).toBe("balanced");
  });

  it("apyTarget.low === targetApyLowBps / 100", () => {
    expect(profile.apyTarget.low).toBe(deployment.targetApyLowBps / 100);
  });

  it("apyTarget.high === targetApyHighBps / 100", () => {
    expect(profile.apyTarget.high).toBe(deployment.targetApyHighBps / 100);
  });

  it("apyTarget.low < apyTarget.high", () => {
    expect(profile.apyTarget.low).toBeLessThan(profile.apyTarget.high);
  });

  it("allocationTargets.mining === targetMiningBps / 100", () => {
    expect(profile.allocationTargets.mining).toBe(
      deployment.targetMiningBps / 100,
    );
  });

  it("4 allocation buckets sum ≈ 100 (±0.01)", () => {
    const t = profile.allocationTargets;
    const sum = t.mining + t.btc_tactical + t.usdc_base + t.stable_reserve;
    expect(Math.abs(sum - 100)).toBeLessThanOrEqual(0.01);
  });

  it("shareClasses has exactly 1 entry", () => {
    expect(profile.shareClasses).toHaveLength(1);
  });

  it("shareClasses[0].minTicketUsdc === deployment.minTicketUsdc.toNumber()", () => {
    expect(profile.shareClasses[0]?.minTicketUsdc).toBe(
      deployment.minTicketUsdc.toNumber(),
    );
  });

  it("label === deployment.name", () => {
    expect(profile.label).toBe(deployment.name);
  });

  it("ticker === deployment.ticker.toUpperCase()", () => {
    expect(profile.ticker).toBe(deployment.ticker.toUpperCase());
  });

  it("id === deployment.ticker.toLowerCase()", () => {
    expect(profile.id).toBe(deployment.ticker.toLowerCase());
  });
});

describe("toVaultProfile — deployment refs (btc_tactical)", () => {
  it("baseMode === 'opportunistic'", () => {
    const deployment = makeDeployment("btc_tactical");
    const profile = toVaultProfile({ kind: "deployment", deployment });
    expect(profile.baseMode).toBe("opportunistic");
  });
});

describe("toVaultProfile — deployment refs (stable_reserve)", () => {
  it("baseMode === 'defensive'", () => {
    const deployment = makeDeployment("stable_reserve");
    const profile = toVaultProfile({ kind: "deployment", deployment });
    expect(profile.baseMode).toBe("defensive");
  });
});

// ---------------------------------------------------------------------------
// Forbidden-words linter
// ---------------------------------------------------------------------------

const FORBIDDEN_WORDS = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
// "not guaranteed" is the sanctioned exception (CLAUDE.md rule #5 / #8).
const NOT_GUARANTEED_EXCEPTION = /not guaranteed/i;

function hasForbiddenWord(text: string): string | null {
  for (const word of FORBIDDEN_WORDS) {
    const re = new RegExp(word, "i");
    if (re.test(text)) {
      // Allow the explicit "not guaranteed" pattern.
      if (word === "guarantee" && NOT_GUARANTEED_EXCEPTION.test(text)) {
        continue;
      }
      return word;
    }
  }
  return null;
}

describe("forbidden-words linter", () => {
  const allDeploymentStrings = (() => {
    const deployment = makeDeployment("mining_yield");
    const profile = toVaultProfile({ kind: "deployment", deployment });
    return [profile.description, ...profile.assumptions];
  })();

  it("deployment description contains no forbidden word", () => {
    const found = hasForbiddenWord(allDeploymentStrings[0] ?? "");
    expect(found).toBeNull();
  });

  it("each deployment assumption contains no forbidden word", () => {
    for (const assumption of allDeploymentStrings.slice(1)) {
      const found = hasForbiddenWord(assumption);
      expect(found, `Forbidden word "${String(found)}" in: "${assumption}"`).toBeNull();
    }
  });

  it("fixture descriptions contain no forbidden word", () => {
    for (const fixture of [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      const found = hasForbiddenWord(fixture.description);
      expect(found, `Forbidden word in fixture "${fixture.id}" description`).toBeNull();
    }
  });

  it("fixture assumptions contain no forbidden word", () => {
    for (const fixture of [VAULT_YIELD, VAULT_DEFENSIVE, VAULT_BTC_PLUS]) {
      for (const assumption of fixture.assumptions) {
        const found = hasForbiddenWord(assumption);
        expect(
          found,
          `Forbidden word "${String(found)}" in fixture "${fixture.id}" assumption: "${assumption}"`,
        ).toBeNull();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Edge cases — data integrity guards (P2 review)
// ---------------------------------------------------------------------------

describe("toVaultProfile — deployment data integrity guards", () => {
  it("throws when allocation bps do NOT sum to 10000 (data corruption)", () => {
    // targetMiningBps 6000 + 2500 + 1000 + 500 = 10000 in makeDeployment.
    // Override to produce a bad sum (e.g. 9000 total).
    const deployment = makeDeployment("mining_yield", {
      targetMiningBps: 5_000, // was 6000 → sum becomes 9000
    });
    expect(() =>
      toVaultProfile({ kind: "deployment", deployment }),
    ).toThrowError(/allocation bps must sum to 10000/i);
  });

  it("throws when targetApyLowBps >= targetApyHighBps (data corruption)", () => {
    const deployment = makeDeployment("mining_yield", {
      targetApyLowBps: 1_500,
      targetApyHighBps: 800, // low > high → invalid
    });
    expect(() =>
      toVaultProfile({ kind: "deployment", deployment }),
    ).toThrowError(/targetApyHighBps.*must be/i);
  });

  it("description defaults to 'Custom deployment' when description is null", () => {
    const deployment = makeDeployment("mining_yield", { description: null });
    const profile = toVaultProfile({ kind: "deployment", deployment });
    expect(profile.description).toBe("Custom deployment");
  });
});
