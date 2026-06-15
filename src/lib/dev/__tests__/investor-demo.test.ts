import { describe, expect, it } from "vitest";

import {
  buildDemoPosition,
  buildDemoVaultSnapshot,
  canSeedInvestorDemo,
  DEMO_MARKER,
  DEMO_YIELD_VAULT_CONTRACT,
} from "@/lib/dev/investor-demo";

describe("investor-demo guard", () => {
  it("allows seed outside production", () => {
    expect(canSeedInvestorDemo("development")).toBe(true);
    expect(canSeedInvestorDemo("test")).toBe(true);
  });

  it("refuses production unless ALLOW_INVESTOR_DEMO_SEED=true", () => {
    expect(canSeedInvestorDemo("production", undefined)).toBe(false);
    expect(canSeedInvestorDemo("production", "true")).toBe(true);
  });
});

describe("investor-demo builders", () => {
  it("marks demo vault snapshot source as demo-staging", () => {
    const snap = buildDemoVaultSnapshot(new Date("2026-06-01T00:00:00Z"));
    expect(snap.source).toBe("demo-staging");
    expect(snap.currentApyLow).toBe(9.4);
    expect(snap.currentApyHigh).toBe(12.8);
  });

  it("builds position with explicit share-class vault key", () => {
    const pos = buildDemoPosition("inv-1", new Date("2026-02-01T00:00:00Z"));
    expect(pos.vaultKey).toContain(":class-A");
    expect(pos.principalUsdc).toBe(500_000);
  });

  it("D4: builds the demo position with no fabricated open tx hash", () => {
    const pos = buildDemoPosition("inv-1", new Date("2026-02-01T00:00:00Z"));
    expect(pos.txHashOpen).toBeNull();
  });

  it("uses a non-placeholder Base Sepolia contract address", () => {
    expect(DEMO_YIELD_VAULT_CONTRACT).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(DEMO_YIELD_VAULT_CONTRACT).not.toMatch(/^0x0{39}[0-9a-f]$/i);
    expect(DEMO_MARKER).toContain("DEMO");
  });
});
