// F3 — vault-btc-plus-fixture-deploy
//
// Verifies that:
//   1. The BTC Plus VaultOnchainDeployment fixture data is structurally correct.
//   2. resolveVault("btc-plus") returns the btc-plus fixture ref (the engine
//      fixture already registers as VaultId "btc-plus"; onchain deployment
//      complements it as on-chain contract metadata).
//   3. The onchain fixture data matches the spec (ADR-006 testnet phase).
//
// The VaultOnchainDeployment rows live in the DB (seeded by prisma/seed.ts);
// for unit tests we verify the fixture constants directly so no DB is required.

import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock @/lib/db (prisma) so resolver.ts does not need a live DB.
// ---------------------------------------------------------------------------
const { findFirstMock } = vi.hoisted(() => ({ findFirstMock: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: {
      findFirst: findFirstMock,
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

import { resolveVault } from "../resolver";
import { VAULT_BTC_PLUS } from "@/lib/engine/vaults";

// ---------------------------------------------------------------------------
// Fixture constants that mirror prisma/seed.ts ONCHAIN_DEPLOYMENT_FIXTURES
// for the btc-plus vault (F3 spec).
// ---------------------------------------------------------------------------
const BTC_PLUS_ONCHAIN = {
  slug: "btc-plus",
  name: "Hearst BTC Plus Vault",
  chainId: 84532,
  address: "0x0000000000000000000000000000000000000003",
  status: "TESTNET",
  apyMin: 0.12,
  apyMax: 0.18,
  lockupDays: 90,
  minTicket: 500_000,
  requiredSigners: 3,
  totalSigners: 5,
} as const;

beforeEach(() => {
  findFirstMock.mockReset();
});

// ---------------------------------------------------------------------------
// 1. Structural correctness of the fixture constants
// ---------------------------------------------------------------------------

describe("BTC Plus onchain deployment fixture — structural checks", () => {
  it("slug matches VaultId 'btc-plus'", () => {
    expect(BTC_PLUS_ONCHAIN.slug).toBe("btc-plus");
  });

  it("seeded name is the historical label; the engine label now carries the retired marker", () => {
    // The seed row keeps the name it was created under — rewriting stored data
    // is not what a preset rename does. The ENGINE label diverges on purpose:
    // it appends "(retired configuration)" so any document generated from this
    // phantom preset states its status. The invariant that matters is that the
    // engine label still recognisably extends the seeded name (so the
    // resolver's label-collision dedup, which also keeps the historical alias,
    // still relates the two).
    expect(BTC_PLUS_ONCHAIN.name).toBe("Hearst BTC Plus Vault");
    expect(VAULT_BTC_PLUS.label).toBe("Hearst BTC Plus Vault (retired configuration)");
    expect(VAULT_BTC_PLUS.label.startsWith(BTC_PLUS_ONCHAIN.name)).toBe(true);
  });

  it("chainId is Base Sepolia (84532)", () => {
    expect(BTC_PLUS_ONCHAIN.chainId).toBe(84532);
  });

  it("address is the expected placeholder", () => {
    expect(BTC_PLUS_ONCHAIN.address).toBe(
      "0x0000000000000000000000000000000000000003",
    );
  });

  it("status is TESTNET", () => {
    expect(BTC_PLUS_ONCHAIN.status).toBe("TESTNET");
  });

  it("apyMin is 0.12 (12%)", () => {
    expect(BTC_PLUS_ONCHAIN.apyMin).toBe(0.12);
  });

  it("apyMax is 0.18 (18%)", () => {
    expect(BTC_PLUS_ONCHAIN.apyMax).toBe(0.18);
  });

  it("apyMin < apyMax (APY is always a range, non-negotiable #1)", () => {
    expect(BTC_PLUS_ONCHAIN.apyMin).toBeLessThan(BTC_PLUS_ONCHAIN.apyMax);
  });

  it("lockupDays is 90", () => {
    expect(BTC_PLUS_ONCHAIN.lockupDays).toBe(90);
  });

  it("minTicket is 500 000", () => {
    expect(BTC_PLUS_ONCHAIN.minTicket).toBe(500_000);
  });

  it("requiredSigners is 3", () => {
    expect(BTC_PLUS_ONCHAIN.requiredSigners).toBe(3);
  });

  it("totalSigners is 5", () => {
    expect(BTC_PLUS_ONCHAIN.totalSigners).toBe(5);
  });

  it("requiredSigners <= totalSigners (M-of-N validity)", () => {
    expect(BTC_PLUS_ONCHAIN.requiredSigners).toBeLessThanOrEqual(
      BTC_PLUS_ONCHAIN.totalSigners,
    );
  });
});

// ---------------------------------------------------------------------------
// 2. resolveVault("btc-plus") returns the btc-plus fixture ref (no DB hit)
// ---------------------------------------------------------------------------

describe("resolveVault('btc-plus') — fixture resolution", () => {
  it("returns a fixture ref for 'btc-plus' without hitting Prisma", async () => {
    const ref = await resolveVault("btc-plus");
    expect(ref).not.toBeNull();
    expect(ref?.kind).toBe("fixture");
    expect(findFirstMock).not.toHaveBeenCalled();
  });

  it("resolved fixture id matches VaultId 'btc-plus'", async () => {
    const ref = await resolveVault("btc-plus");
    if (ref?.kind === "fixture") {
      expect(ref.fixture.id).toBe("btc-plus");
    }
  });

  it("resolved fixture ticker is HBP", async () => {
    const ref = await resolveVault("btc-plus");
    if (ref?.kind === "fixture") {
      expect(ref.fixture.ticker).toBe("HBP");
    }
  });

  it("resolved fixture apyTarget matches BTC Plus onchain apyMin/apyMax", async () => {
    const ref = await resolveVault("btc-plus");
    if (ref?.kind === "fixture") {
      // Engine fixture APY range spans the onchain apyMin–apyMax band (10–20%).
      expect(ref.fixture.apyTarget.low).toBeLessThanOrEqual(
        BTC_PLUS_ONCHAIN.apyMin * 100,
      );
      expect(ref.fixture.apyTarget.high).toBeGreaterThanOrEqual(
        BTC_PLUS_ONCHAIN.apyMax * 100,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// 3. Forbidden-words guard — no banned terms in fixture descriptions
// ---------------------------------------------------------------------------

const FORBIDDEN = ["guarantee", "promise", "certain", "will deliver", "risk-free"];
const NOT_GUARANTEED_RE = /not guaranteed/i;

function checkForbidden(text: string): string | null {
  for (const word of FORBIDDEN) {
    const re = new RegExp(word, "i");
    if (re.test(text)) {
      if (word === "guarantee" && NOT_GUARANTEED_RE.test(text)) continue;
      return word;
    }
  }
  return null;
}

describe("forbidden-words — btc-plus fixture", () => {
  it("description contains no forbidden word", () => {
    expect(checkForbidden(VAULT_BTC_PLUS.description)).toBeNull();
  });

  it("each assumption contains no forbidden word", () => {
    for (const assumption of VAULT_BTC_PLUS.assumptions) {
      expect(
        checkForbidden(assumption),
        `Forbidden word in assumption: "${assumption}"`,
      ).toBeNull();
    }
  });
});
