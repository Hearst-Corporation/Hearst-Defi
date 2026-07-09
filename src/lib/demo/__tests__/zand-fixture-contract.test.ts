import { describe, expect, it } from "vitest";

import {
  ZAND_FIXTURE_EMAIL,
  ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC,
  ZAND_FIXTURE_PRINCIPAL_USDC,
  ZAND_FIXTURE_VAULT_KEY,
  ZAND_SEED_DEPOSIT_TXHASH,
} from "@/lib/demo/zand-fixture";

describe("zand fixture contract", () => {
  it("keeps a stable Zand identity", () => {
    expect(ZAND_FIXTURE_EMAIL).toBe("zand.demo@hearstcorporation.io");
    expect(ZAND_FIXTURE_VAULT_KEY).toContain(":class-");
  });

  it("uses a deterministic non-zero principal", () => {
    expect(ZAND_FIXTURE_PRINCIPAL_USDC).toBe(2_000_000);
    expect(Number.isFinite(ZAND_FIXTURE_PRINCIPAL_USDC)).toBe(true);
    expect(ZAND_FIXTURE_PRINCIPAL_USDC).toBeGreaterThan(0);
  });

  it("keeps 12 monthly distributions with valid positive amounts", () => {
    expect(ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC).toHaveLength(12);
    for (const amount of ZAND_FIXTURE_MONTHLY_DISTRIBUTIONS_USDC) {
      expect(Number.isFinite(amount)).toBe(true);
      expect(amount).toBeGreaterThan(0);
    }
  });

  it("exposes the unique idempotency tx hash marker", () => {
    expect(ZAND_SEED_DEPOSIT_TXHASH).toBe(
      "0xZANDDEMOSEED0000000000000000000000000000000000000000000000000000",
    );
    expect(ZAND_SEED_DEPOSIT_TXHASH.length).toBeGreaterThan(10);
  });
});
