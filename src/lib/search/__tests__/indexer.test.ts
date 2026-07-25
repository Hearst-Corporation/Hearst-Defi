/**
 * Indexer unit tests — pure logic only.
 *
 * The Prisma layer is mocked entirely so these tests run without a DB.
 * We test:
 * 1. buildSearchIndex returns max MAX_PER_SECTION per entity section
 * 2. buildSearchIndex respects Prisma "where" filtering (mock returns filtered data)
 * 3. Direct jump: address → directJump=true
 * 4. Direct jump: tx hash → directJump=true
 * 5. Direct jump: id prefix "HYV-" → directJump=true
 * 6. Empty query → no results, no direct jump
 */

import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must be declared before any import that uses the mocked modules
// ---------------------------------------------------------------------------

vi.mock("server-only", () => ({}));

// We mock the entire prisma singleton. Vitest's vi.mock hoisting ensures
// this runs before `indexer.ts` is evaluated.
vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDeployment: { findMany: vi.fn() },
    investor: { findMany: vi.fn() },
    position: { findMany: vi.fn() },
    distribution: { findMany: vi.fn() },
    proof: { findMany: vi.fn() },
    proposalSignature: { findMany: vi.fn() },
    scenarioRun: { findMany: vi.fn() },
    backtestRun: { findMany: vi.fn() },
    reportExport: { findMany: vi.fn() },
    rebalanceEvent: { findMany: vi.fn() },
  },
}));

// Import AFTER mocks are established
import { buildSearchIndex } from "../indexer";
import { MAX_PER_SECTION } from "../types";
import * as dbModule from "@/lib/db";

// Double-cast through unknown to safely access mock fns without TS overlap error.
const prisma = vi.mocked(dbModule.prisma) as unknown as {
  vaultDeployment: { findMany: Mock };
  investor: { findMany: Mock };
  position: { findMany: Mock };
  distribution: { findMany: Mock };
  proof: { findMany: Mock };
  proposalSignature: { findMany: Mock };
  scenarioRun: { findMany: Mock };
  backtestRun: { findMany: Mock };
  reportExport: { findMany: Mock };
  rebalanceEvent: { findMany: Mock };
};

// ---------------------------------------------------------------------------
// Helper: return N vault rows matching "HYV" query
// ---------------------------------------------------------------------------

function makeVaultRows(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `vault-${i}`,
    ticker: `HYV-${String.fromCharCode(65 + i)}`,
    name: `Hearst Yield Vault ${i}`,
    strategy: "mining_yield",
    status: "live",
  }));
}

function seedAllMocks(vaults = makeVaultRows(0)) {
  prisma.vaultDeployment.findMany.mockResolvedValue(vaults);
  prisma.investor.findMany.mockResolvedValue([]);
  prisma.position.findMany.mockResolvedValue([]);
  prisma.distribution.findMany.mockResolvedValue([]);
  prisma.proof.findMany.mockResolvedValue([]);
  prisma.proposalSignature.findMany.mockResolvedValue([]);
  prisma.scenarioRun.findMany.mockResolvedValue([]);
  prisma.backtestRun.findMany.mockResolvedValue([]);
  prisma.reportExport.findMany.mockResolvedValue([]);
  prisma.rebalanceEvent.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe("buildSearchIndex", () => {
  it("returns max MAX_PER_SECTION per entity section", async () => {
    // Seed prisma with MORE than MAX_PER_SECTION vault rows.
    // The indexer queries with take: MAX_PER_SECTION * 2 then slices to MAX_PER_SECTION.
    const overLimit = makeVaultRows(MAX_PER_SECTION + 3);
    seedAllMocks(overLimit);

    const response = await buildSearchIndex("HYV");

    const vaultResults = response.results.filter((r) => r.entity === "vault");
    expect(vaultResults.length).toBeLessThanOrEqual(MAX_PER_SECTION);
  });

  it("query HYV returns vault results when Prisma returns matching rows", async () => {
    seedAllMocks(makeVaultRows(3));

    const response = await buildSearchIndex("HYV");

    expect(response.query).toBe("HYV");
    expect(response.directJump).toBe(false);
    // All returned rows have entity "vault"
    const vaultResults = response.results.filter((r) => r.entity === "vault");
    expect(vaultResults.length).toBeGreaterThan(0);
    expect(vaultResults[0]!.href).toMatch(/^\/admin\/vaults\//);
  });

  it("empty query returns empty results without touching Prisma", async () => {
    seedAllMocks();

    const response = await buildSearchIndex("");

    expect(response.results).toHaveLength(0);
    expect(response.directJump).toBe(false);
    // No Prisma calls for empty query
    expect(prisma.vaultDeployment.findMany).not.toHaveBeenCalled();
  });

  it("address detected → directJump=true, no Prisma call", async () => {
    seedAllMocks();
    const address = "0x" + "a".repeat(40);

    const response = await buildSearchIndex(address);

    expect(response.directJump).toBe(true);
    expect(response.directHref).toBe("/admin/customers");
    expect(response.results).toHaveLength(0);
    expect(prisma.vaultDeployment.findMany).not.toHaveBeenCalled();
  });

  it("tx hash detected → directJump=true", async () => {
    seedAllMocks();
    const txHash = "0x" + "b".repeat(64);

    const response = await buildSearchIndex(txHash);

    expect(response.directJump).toBe(true);
    expect(response.directHref).toBe("/admin/signals");
  });

  it("id prefix HYV- detected → directJump=true", async () => {
    seedAllMocks();

    const response = await buildSearchIndex("HYV-001");

    expect(response.directJump).toBe(true);
    expect(response.directHref).toBe("/admin/vaults/HYV-001");
  });

  it("Prisma filtering: only rows matching query are returned", async () => {
    // Simulate Prisma returning nothing (no match)
    seedAllMocks([]);

    const response = await buildSearchIndex("nonexistent-xyz-query");

    expect(response.results).toHaveLength(0);
    expect(response.directJump).toBe(false);
  });
});
