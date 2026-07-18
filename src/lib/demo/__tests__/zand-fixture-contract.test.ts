import { describe, expect, it } from "vitest";

import {
  ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC,
  ZAND_FIXTURE_DISTRIBUTED_USDC,
  ZAND_FIXTURE_EMAIL,
  ZAND_FIXTURE_POCKET_SPLIT,
  ZAND_FIXTURE_PRINCIPAL_USDC,
  ZAND_FIXTURE_VAULT_KEY,
  ZAND_SEED_DEPOSIT_TXHASH,
} from "@/lib/demo/zand-fixture";

describe("zand fixture contract (SERIES 1 mining note, v3.0)", () => {
  it("keeps a stable Zand identity", () => {
    expect(ZAND_FIXTURE_EMAIL).toBe("zand.demo@hearstcorporation.io");
    expect(ZAND_FIXTURE_VAULT_KEY).toContain(":class-");
  });

  it("uses a deterministic non-zero principal", () => {
    expect(ZAND_FIXTURE_PRINCIPAL_USDC).toBe(2_000_000);
    expect(Number.isFinite(ZAND_FIXTURE_PRINCIPAL_USDC)).toBe(true);
    expect(ZAND_FIXTURE_PRINCIPAL_USDC).toBeGreaterThan(0);
  });

  it("allocates capital across the 3 SERIES 1 pockets B1/B2/B3 = 40/27/33", () => {
    expect(ZAND_FIXTURE_POCKET_SPLIT.miningPowerPct).toBe(40);
    expect(ZAND_FIXTURE_POCKET_SPLIT.btcPouchPct).toBe(27);
    expect(ZAND_FIXTURE_POCKET_SPLIT.reserveUsdcPct).toBe(33);
    const sum =
      ZAND_FIXTURE_POCKET_SPLIT.miningPowerPct +
      ZAND_FIXTURE_POCKET_SPLIT.btcPouchPct +
      ZAND_FIXTURE_POCKET_SPLIT.reserveUsdcPct;
    expect(sum).toBe(100);
  });

  it("accumulates BTC value (capitalized, delivered at maturity), never distributes cash", () => {
    // BTC accumulation is a positive, deterministic Estimated USD figure...
    expect(Number.isFinite(ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC)).toBe(true);
    expect(ZAND_FIXTURE_ACCUMULATED_BTC_VALUE_USDC).toBeGreaterThan(0);
    // ...and there is ZERO periodic cash distribution on a SERIES 1 note.
    expect(ZAND_FIXTURE_DISTRIBUTED_USDC).toBe(0);
  });

  it("exposes the unique idempotency tx hash marker", () => {
    expect(ZAND_SEED_DEPOSIT_TXHASH).toBe(
      "0xZANDDEMOSEED0000000000000000000000000000000000000000000000000000",
    );
    expect(ZAND_SEED_DEPOSIT_TXHASH.length).toBeGreaterThan(10);
  });
});
