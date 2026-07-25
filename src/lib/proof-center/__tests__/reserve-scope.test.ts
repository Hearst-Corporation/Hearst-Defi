/**
 * Reserve events scope honesty (E5 — Z3 "fuite de scope").
 *
 * The old `rebalanceVaultScopeWhere` OR-ed `{vaultRef:"yield"}` and
 * `{vaultRef:null}` into EVERY scope, so a defensive/btc-plus request silently
 * surfaced the flagship's rows. Locked here:
 *  - non-flagship scopes match their own vaultRef ONLY;
 *  - the flagship scope keeps its documented assumption (legacy slug +
 *    unscoped null rows belong to Series 1);
 *  - `cancelled` events stay excluded BY DESIGN (declared in the loader doc).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { rebalanceFindMany } = vi.hoisted(() => ({
  rebalanceFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    rebalanceEvent: { findMany: rebalanceFindMany },
    distribution: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { loadRecentRebalances } from "@/lib/data/proof-center";

beforeEach(() => {
  rebalanceFindMany.mockReset().mockResolvedValue([]);
});

function sentWhere(): Record<string, unknown> {
  expect(rebalanceFindMany).toHaveBeenCalledTimes(1);
  const call = rebalanceFindMany.mock.calls[0]?.[0];
  if (!call) throw new Error("rebalanceEvent.findMany was not called with args");
  return call.where;
}

describe("loadRecentRebalances — vault scope", () => {
  it("defensive scope matches vaultRef 'defensive' ONLY — no flagship leak", async () => {
    await loadRecentRebalances("defensive");
    const where = sentWhere();
    expect(where.vaultRef).toBe("defensive");
    expect(where).not.toHaveProperty("OR");
  });

  it("btc-plus scope matches vaultRef 'btc-plus' ONLY", async () => {
    await loadRecentRebalances("btc-plus");
    const where = sentWhere();
    expect(where.vaultRef).toBe("btc-plus");
    expect(where).not.toHaveProperty("OR");
  });

  it("flagship scope includes legacy slug + unscoped rows (documented assumption)", async () => {
    await loadRecentRebalances("yield");
    const where = sentWhere();
    expect(where.OR).toEqual([
      { vaultRef: "yield" },
      { vaultRef: "hearst-yield-vault" },
      { vaultRef: null },
    ]);
  });

  it("legacy 'hearst-yield-vault' ref normalises to the same flagship scope", async () => {
    await loadRecentRebalances("hearst-yield-vault");
    const where = sentWhere();
    expect(where.OR).toEqual([
      { vaultRef: "yield" },
      { vaultRef: "hearst-yield-vault" },
      { vaultRef: null },
    ]);
  });

  it("cancelled events are excluded by design (declared, not silent)", async () => {
    await loadRecentRebalances("yield");
    const where = sentWhere();
    expect(where.status).toEqual({ in: ["executed", "approved", "pending"] });
  });
});
