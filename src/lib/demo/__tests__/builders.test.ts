import { describe, expect, it } from "vitest";

import { DEMO_YIELD_VAULT_ID } from "@/lib/dev/investor-demo";
import { DEMO_SENTINEL_HASH } from "../markers";
import {
  buildDemoPortfolio,
  buildDemoProofs,
  buildDemoVaultDetail,
  buildDemoVaults,
} from "../builders";

const DEMO_VAULT_NAME = "Hearst Yield Vault";
const DEMO_VAULT_TICKER = "HYV-A";

describe("buildDemoVaults", () => {
  it("returns exactly one live, navigable demo vault", () => {
    const vaults = buildDemoVaults();
    expect(vaults).toHaveLength(1);
    const v = vaults[0]!;
    expect(v.id).toBe(DEMO_YIELD_VAULT_ID);
    expect(v.ticker).toBe(DEMO_VAULT_TICKER);
    expect(v.name).toBe(DEMO_VAULT_NAME);
    // status MUST be live so the detail page is navigable + deposit CTA shows.
    expect(v.status).toBe("live");
  });

  it("APY is a coherent range (low < high)", () => {
    const v = buildDemoVaults()[0]!;
    expect(v.apyLow).toBeLessThan(v.apyHigh);
    expect(v.apyLow).toBeGreaterThan(0);
  });

  it("all required VaultProduct fields are present and well-typed", () => {
    const v = buildDemoVaults()[0]!;
    expect(typeof v.description).toBe("string");
    expect(typeof v.minTicketUsdc).toBe("number");
    expect(typeof v.softLockupDays).toBe("number");
    expect(typeof v.capacityUsdc).toBe("number");
    expect(typeof v.currentAumUsdc).toBe("number");
    expect(typeof v.fees.mgmtBps).toBe("number");
    expect(typeof v.fees.perfBps).toBe("number");
    expect(typeof v.fees.hurdleBps).toBe("number");
    expect(typeof v.spvJurisdiction).toBe("string");
    expect(typeof v.shareClass).toBe("string");
    expect(typeof v.regExemption).toBe("string");
    expect(typeof v.disclaimers).toBe("string");
    // Target allocation buckets sum to 10000 bps (100%).
    const sum =
      v.targetMiningBps +
      v.targetBtcTacticalBps +
      v.targetUsdcBaseBps +
      v.targetStableReserveBps;
    expect(sum).toBe(10_000);
  });
});

describe("buildDemoVaultDetail", () => {
  it("returns the demo vault for the demo id", () => {
    const v = buildDemoVaultDetail(DEMO_YIELD_VAULT_ID);
    expect(v).not.toBeNull();
    expect(v!.id).toBe(DEMO_YIELD_VAULT_ID);
  });

  it("matches the ticker case-insensitively", () => {
    expect(buildDemoVaultDetail("hyv-a")).not.toBeNull();
    expect(buildDemoVaultDetail("HYV-A")).not.toBeNull();
  });

  it("returns null for any other id (preserves notFound())", () => {
    expect(buildDemoVaultDetail("some-other-vault")).toBeNull();
    expect(buildDemoVaultDetail("")).toBeNull();
  });

  it("the detail vault equals the list vault", () => {
    expect(buildDemoVaultDetail(DEMO_YIELD_VAULT_ID)).toEqual(
      buildDemoVaults()[0],
    );
  });
});

describe("buildDemoPortfolio", () => {
  it("has one active position referencing the demo vault", () => {
    const p = buildDemoPortfolio();
    expect(p.positions).toHaveLength(1);
    const pos = p.positions[0]!;
    expect(pos.vaultName).toBe(DEMO_VAULT_NAME);
    expect(pos.status).toBe("active");
  });

  it("position APY range matches the demo vault range", () => {
    const vault = buildDemoVaults()[0]!;
    const pos = buildDemoPortfolio().positions[0]!;
    expect(pos.apyLow).toBe(vault.apyLow);
    expect(pos.apyHigh).toBe(vault.apyHigh);
  });

  it("uses source='fallback' (the union is NOT extended with 'demo')", () => {
    const p = buildDemoPortfolio();
    expect(p.source).toBe("fallback");
    // @ts-expect-error — "demo" is intentionally not a valid source value.
    const invalid: typeof p.source = "demo";
    expect(invalid).toBeDefined();
  });

  it("totalValue = principal + accrued and is internally coherent", () => {
    const p = buildDemoPortfolio();
    const pos = p.positions[0]!;
    expect(pos.valueUsdc).toBe(pos.principalUsdc + pos.accruedYieldUsdc);
    expect(p.totalValueUsdc).toBe(pos.valueUsdc);
  });

  it("distributions in recent activity sum to the position's distributed total", () => {
    const p = buildDemoPortfolio();
    const pos = p.positions[0]!;
    const distributedFromTxs = p.recentTransactions
      .filter((t) => t.type === "distribution")
      .reduce((sum, t) => sum + t.amountUsdc, 0);
    expect(distributedFromTxs).toBe(pos.distributedUsdc);
  });

  it("presents no settled tx hash (honesty rule)", () => {
    const p = buildDemoPortfolio();
    for (const t of p.recentTransactions) {
      expect(t.txHash).toBeNull();
    }
  });

  it("carries a coherent aggregate P&L", () => {
    const p = buildDemoPortfolio();
    expect(p.pnl).toBeDefined();
    expect(p.pnl!.contributedUsdc).toBe(p.positions[0]!.principalUsdc);
  });
});

describe("buildDemoProofs", () => {
  it("returns the four proof types", () => {
    const proofs = buildDemoProofs();
    const types = proofs.map((pr) => pr.proofType).sort();
    expect(types).toEqual(
      ["audit", "custody", "methodology", "mining_attestation"].sort(),
    );
  });

  it("references the demo vault's period on the periodic proofs", () => {
    const proofs = buildDemoProofs();
    const mining = proofs.find((pr) => pr.proofType === "mining_attestation")!;
    const custody = proofs.find((pr) => pr.proofType === "custody")!;
    expect(mining.period).toBe("2026-05");
    expect(custody.period).toBe("2026-05");
    expect(mining.title).toContain("2026-05");
  });

  it("claims no settled on-chain tx (txHash null) on any proof", () => {
    for (const pr of buildDemoProofs()) {
      expect(pr.txHash).toBeNull();
    }
  });

  it("all required ProofItem fields are present", () => {
    for (const pr of buildDemoProofs()) {
      expect(typeof pr.id).toBe("string");
      expect(typeof pr.title).toBe("string");
      expect(typeof pr.hash).toBe("string");
      expect(typeof pr.uri).toBe("string");
      expect(typeof pr.postedAt).toBe("string");
      expect(typeof pr.postedBy).toBe("string");
    }
  });
});

describe("DEMO_SENTINEL_HASH — clearly a sentinel, never a settled tx", () => {
  it("is the fixed, clearly-sentinel 0xde…0 value", () => {
    expect(DEMO_SENTINEL_HASH.startsWith("0xde")).toBe(true);
    expect(DEMO_SENTINEL_HASH).toBe(
      "0xde00000000000000000000000000000000000000000000000000000000000000",
    );
  });

  it("appears ONLY as a document digest (proof.hash), NEVER as a settled tx", () => {
    // Honesty rule: the demo never claims an on-chain settlement. The sentinel
    // is a document digest on proof.hash; every proof's txHash stays null, so
    // nothing here is presented as a real settled transaction.
    for (const pr of buildDemoProofs()) {
      expect(pr.hash).toBe(DEMO_SENTINEL_HASH);
      expect(pr.txHash).toBeNull();
    }
  });
});

describe("cross-builder coherence", () => {
  it("vault, portfolio position, and proofs all reference one demo vault", () => {
    const vault = buildDemoVaults()[0]!;
    const pos = buildDemoPortfolio().positions[0]!;
    // Same vault name across vault + portfolio.
    expect(pos.vaultName).toBe(vault.name);
    // The detail builder resolves the same id used by the vault list.
    expect(buildDemoVaultDetail(vault.id)!.id).toBe(vault.id);
    // Proof period matches the vault's distribution cadence window.
    const proofs = buildDemoProofs();
    expect(proofs.some((pr) => pr.period === "2026-05")).toBe(true);
  });
});
