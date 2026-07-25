/**
 * Anti-regression for Z3 TOP9 — the timelock section of /proof-center/full.
 *
 * The old loader filtered `GovernanceProposal` with `vault:{ticker: vaultRef}`
 * where `vaultRef` is an engine FIXTURE id ("yield"), never a deployment
 * ticker — a join that could never match, so the section always rendered
 * "No pending timelocks" and an operator read it as "no proposal exists".
 *
 * These tests lock the fixed contract: the `where` sent to Prisma must always
 * be able to match — a fixture/absent scope carries NO vault constraint
 * (platform-wide queue), a deployment scope filters by `vaultDeploymentId`
 * (a real column), and the impossible `vault.ticker = <fixture id>` shape is
 * asserted gone.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const { governanceFindMany, resolveVaultMock, getProofsMock } = vi.hoisted(() => ({
  governanceFindMany: vi.fn(),
  resolveVaultMock: vi.fn(),
  getProofsMock: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: { governanceProposal: { findMany: governanceFindMany } },
}));
vi.mock("@/lib/chain/event-logger", () => ({
  fetchOnChainEvents: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/data/custody", () => ({
  loadCustody: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/data/proofs", () => ({
  getProofs: getProofsMock,
}));
vi.mock("@/lib/proof-center/platform-addresses", () => ({
  buildPlatformAddresses: vi.fn().mockReturnValue([]),
}));
vi.mock("@/lib/vaults/resolver", () => ({
  resolveVault: resolveVaultMock,
}));

import {
  loadProofCenterFullLog,
  timelockScopeWhere,
} from "@/lib/proof-center/full-log-loader";

const TIMELOCK_ROW = {
  id: "prop_1",
  state: "TIMELOCK",
  queuedAt: new Date("2026-07-01T00:00:00Z"),
  createdAt: new Date("2026-06-30T00:00:00Z"),
  timelockHours: 48,
};

beforeEach(() => {
  governanceFindMany.mockReset().mockResolvedValue([TIMELOCK_ROW]);
  resolveVaultMock.mockReset();
  getProofsMock
    .mockReset()
    .mockResolvedValue({ data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 });
});

function sentWhere(): Record<string, unknown> {
  expect(governanceFindMany).toHaveBeenCalledTimes(1);
  const call = governanceFindMany.mock.calls[0]?.[0];
  if (!call) throw new Error("governanceProposal.findMany was not called with args");
  return call.where;
}

describe("timelock scope — the where must always be able to match (TOP9)", () => {
  it("fixture scope ('yield'): NO vault constraint — the impossible ticker join is gone", async () => {
    resolveVaultMock.mockResolvedValue({
      kind: "fixture",
      fixture: { id: "yield", ticker: "HYV", label: "Series 1" },
    });

    const result = await loadProofCenterFullLog("yield");

    const where = sentWhere();
    expect(where.state).toBe("TIMELOCK");
    // The dead join: vault:{ticker:"yield"} — must never come back.
    expect(where).not.toHaveProperty("vault");
    // Fixtures own no deployments, so no deployment filter either.
    expect(where).not.toHaveProperty("vaultDeploymentId");
    // And the queue actually reaches the section.
    expect(result.timelockProposals).toHaveLength(1);
  });

  it("deployment scope: filters by vaultDeploymentId (a real column)", async () => {
    resolveVaultMock.mockResolvedValue({
      kind: "deployment",
      deployment: { id: "cmx_deploy_1", ticker: "HYV-B" },
    });

    await loadProofCenterFullLog("hyv-b");

    const where = sentWhere();
    expect(where.state).toBe("TIMELOCK");
    expect(where.vaultDeploymentId).toBe("cmx_deploy_1");
    expect(where).not.toHaveProperty("vault");
  });

  it("no scope: platform-wide queue, resolver not consulted", async () => {
    await loadProofCenterFullLog();

    expect(resolveVaultMock).not.toHaveBeenCalled();
    expect(sentWhere()).toEqual({ state: "TIMELOCK" });
  });

  it("unknown ref (resolver null): no constraint rather than a fabricated empty", async () => {
    resolveVaultMock.mockResolvedValue(null);
    await expect(timelockScopeWhere("nonexistent")).resolves.toEqual({});
  });
});

describe("proofs window honesty", () => {
  it("exposes proofsTotal so callers can declare 'showing X of Y'", async () => {
    getProofsMock.mockResolvedValue({
      data: [],
      total: 137,
      page: 1,
      pageSize: 50,
      totalPages: 3,
    });

    const result = await loadProofCenterFullLog();
    expect(result.proofsTotal).toBe(137);
  });
});
