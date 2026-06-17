/**
 * Action-queue producer tests — src/lib/data/cockpit.ts (buildActionQueue)
 *
 * Tests that each of the 4 new producers (multisig.sign, vault.paused,
 * distribution.approve, kyc.review) emits the correct ActionQueueItem when
 * backing data exists, and emits nothing when the relevant tables are empty.
 *
 * Mocking strategy: vi.hoisted() creates the mock object before vi.mock()
 * factories execute (vitest hoists vi.mock calls to the top of the file).
 *
 * server-only is stubbed so the module can be imported outside a Next.js
 * server environment.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// ---------------------------------------------------------------------------
// Create the mock via vi.hoisted so it is available inside vi.mock factories.
// ---------------------------------------------------------------------------

const prismaMock = vi.hoisted(() => ({
  vaultSnapshot: { findFirst: vi.fn().mockResolvedValue(null) },
  miningMetric: { findFirst: vi.fn().mockResolvedValue(null) },
  rebalanceEvent: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  proof: { findFirst: vi.fn().mockResolvedValue(null) },
  governanceProposal: { findMany: vi.fn().mockResolvedValue([]) },
  vaultDeployment: { findMany: vi.fn().mockResolvedValue([]) },
  distributionApproval: {
    groupBy: vi.fn().mockResolvedValue([]),
  },
  investor: { findMany: vi.fn().mockResolvedValue([]) },
  kycInquiry: { findMany: vi.fn().mockResolvedValue([]) },
  llmRun: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
  },
  distribution: {
    findFirst: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
  },
  adminAudit: { findMany: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

// Stub vaults resolver — cockpit uses listAllVaults inside buildVaultMetrics.
vi.mock("@/lib/vaults/resolver", () => ({
  listAllVaults: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/vaults/slug", () => ({
  vaultLabel: vi.fn().mockReturnValue("Test Vault"),
  vaultSlug: vi.fn().mockReturnValue("test-vault"),
}));

import { loadCockpitPayload } from "@/lib/data/cockpit";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resetAllMocks() {
  prismaMock.vaultSnapshot.findFirst.mockResolvedValue(null);
  prismaMock.miningMetric.findFirst.mockResolvedValue(null);
  prismaMock.rebalanceEvent.findFirst.mockResolvedValue(null);
  prismaMock.rebalanceEvent.findMany.mockResolvedValue([]);
  prismaMock.proof.findFirst.mockResolvedValue(null);
  prismaMock.governanceProposal.findMany.mockResolvedValue([]);
  prismaMock.vaultDeployment.findMany.mockResolvedValue([]);
  prismaMock.distributionApproval.groupBy.mockResolvedValue([]);
  prismaMock.investor.findMany.mockResolvedValue([]);
  prismaMock.kycInquiry.findMany.mockResolvedValue([]);
  prismaMock.llmRun.findMany.mockResolvedValue([]);
  prismaMock.llmRun.count.mockResolvedValue(0);
  prismaMock.distribution.findFirst.mockResolvedValue(null);
  prismaMock.distribution.findMany.mockResolvedValue([]);
  prismaMock.adminAudit.findMany.mockResolvedValue([]);
}

// ---------------------------------------------------------------------------
// 1. multisig.sign — GovernanceProposal in SIGNING state
// ---------------------------------------------------------------------------

describe("buildActionQueue — multisig.sign producer", () => {
  beforeEach(resetAllMocks);

  it("emits a multisig.sign item for each SIGNING proposal", async () => {
    prismaMock.governanceProposal.findMany.mockResolvedValue([
      {
        id: "prop-001",
        state: "SIGNING",
        actionType: "pause",
        requiredSigners: 3,
        createdAt: new Date("2026-06-01T10:00:00Z"),
        signatures: [{ signerAddress: "0xAA" }],
      },
      {
        id: "prop-002",
        state: "SIGNING",
        actionType: "updateFees",
        requiredSigners: 2,
        createdAt: new Date("2026-06-02T10:00:00Z"),
        signatures: [],
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "multisig.sign");
    expect(items).toHaveLength(2);

    const first = items.find((i) => i.id === "multisig-sign-prop-001");
    expect(first).toBeDefined();
    expect(first?.severity).toBe("P0");
    expect(first?.href).toBe("/admin/governance/proposal/prop-001");
    expect(first?.context).toContain("1 of 3");

    const second = items.find((i) => i.id === "multisig-sign-prop-002");
    expect(second?.context).toContain("0 of 2");
  });

  it("emits no multisig.sign items when no SIGNING proposals exist", async () => {
    prismaMock.governanceProposal.findMany.mockResolvedValue([]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "multisig.sign");
    expect(items).toHaveLength(0);
  });

  it("item href points to /admin/governance/proposal/<id>", async () => {
    prismaMock.governanceProposal.findMany.mockResolvedValue([
      {
        id: "prop-abc",
        state: "SIGNING",
        actionType: "deploy",
        requiredSigners: 2,
        createdAt: new Date("2026-06-01T10:00:00Z"),
        signatures: [],
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const item = actionQueue.find((i) => i.type === "multisig.sign");
    expect(item?.href).toBe("/admin/governance/proposal/prop-abc");
  });
});

describe("buildActionQueue — rebalance.signal producer", () => {
  beforeEach(resetAllMocks);

  it("scopes the signals href to the pending rebalance vault when available", async () => {
    prismaMock.rebalanceEvent.findFirst.mockResolvedValue({
      id: "reb-001",
      triggeredAt: new Date("2026-06-01T10:00:00Z"),
      triggerText: "Defensive posture breached threshold",
      vaultRef: "defensive",
    });

    const { actionQueue } = await loadCockpitPayload();
    const item = actionQueue.find((i) => i.type === "rebalance.signal");

    expect(item).toBeDefined();
    expect(item?.href).toBe("/admin/signals?vault=defensive");
  });

  it("falls back to the base signals route when vault scope is absent", async () => {
    prismaMock.rebalanceEvent.findFirst.mockResolvedValue({
      id: "reb-002",
      triggeredAt: new Date("2026-06-01T10:00:00Z"),
      triggerText: "Legacy pending signal",
      vaultRef: null,
    });

    const { actionQueue } = await loadCockpitPayload();
    const item = actionQueue.find((i) => i.type === "rebalance.signal");

    expect(item).toBeDefined();
    expect(item?.href).toBe("/admin/signals");
  });
});

// ---------------------------------------------------------------------------
// 2. vault.paused — VaultDeployment with status "paused"
// ---------------------------------------------------------------------------

describe("buildActionQueue — vault.paused producer", () => {
  beforeEach(resetAllMocks);

  it("emits a vault.paused item for each paused vault", async () => {
    prismaMock.vaultDeployment.findMany.mockResolvedValue([
      {
        id: "vd-001",
        name: "Hearst Yield Vault",
        ticker: "HYV-A",
        status: "paused",
        pausedAt: new Date("2026-06-05T12:00:00Z"),
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
      {
        id: "vd-002",
        name: "Defensive Vault",
        ticker: "HDF-A",
        status: "paused",
        pausedAt: new Date("2026-06-06T08:00:00Z"),
        createdAt: new Date("2026-05-02T00:00:00Z"),
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "vault.paused");
    expect(items).toHaveLength(2);

    const first = items.find((i) => i.id === "vault-paused-vd-001");
    expect(first).toBeDefined();
    expect(first?.severity).toBe("P0");
    expect(first?.href).toBe("/admin/vaults/vd-001");
    expect(first?.title).toContain("Hearst Yield Vault");
    expect(first?.context).toBe("HYV-A");
  });

  it("emits no vault.paused items when no paused vaults exist", async () => {
    prismaMock.vaultDeployment.findMany.mockResolvedValue([]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "vault.paused");
    expect(items).toHaveLength(0);
  });

  it("uses pausedAt as createdAt when available", async () => {
    const pausedAt = new Date("2026-06-05T12:00:00Z");
    prismaMock.vaultDeployment.findMany.mockResolvedValue([
      {
        id: "vd-003",
        name: "Test Vault",
        ticker: "TST-A",
        status: "paused",
        pausedAt,
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const item = actionQueue.find((i) => i.type === "vault.paused");
    expect(item?.createdAt).toBe(pausedAt.toISOString());
  });

  it("falls back to createdAt when pausedAt is null", async () => {
    const createdAt = new Date("2026-05-01T00:00:00Z");
    prismaMock.vaultDeployment.findMany.mockResolvedValue([
      {
        id: "vd-004",
        name: "Fallback Vault",
        ticker: "FBK-A",
        status: "paused",
        pausedAt: null,
        createdAt,
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const item = actionQueue.find((i) => i.type === "vault.paused");
    expect(item?.createdAt).toBe(createdAt.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 3. distribution.approve — DistributionApproval below threshold
// ---------------------------------------------------------------------------

describe("buildActionQueue — distribution.approve producer", () => {
  beforeEach(resetAllMocks);

  it("emits a distribution.approve item when a period has 1 of 2 signers", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-06", _count: { signerWallet: 1 } },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(1);

    const item = items[0]!;
    expect(item.id).toBe("distribution-approve-2026-06");
    expect(item.severity).toBe("P1");
    expect(item.href).toBe("/admin/distributions");
    expect(item.context).toContain("1 of 2");
  });

  it("emits no distribution.approve item when period already has 2 of 2 signers", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-05", _count: { signerWallet: 2 } },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(0);
  });

  it("emits no items when no approvals exist", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(0);
  });

  it("emits one item per pending period, skips periods at threshold", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-04", _count: { signerWallet: 1 } },
      { period: "2026-05", _count: { signerWallet: 2 } }, // threshold met — no item
      { period: "2026-06", _count: { signerWallet: 1 } },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.id)).toContain("distribution-approve-2026-04");
    expect(items.map((i) => i.id)).toContain("distribution-approve-2026-06");
  });
});

// ---------------------------------------------------------------------------
// 4. kyc.review — KycInquiry rows not linked to an approved investor
// ---------------------------------------------------------------------------

describe("buildActionQueue — kyc.review producer", () => {
  beforeEach(resetAllMocks);

  it("emits a kyc.review item for each pending KycInquiry", async () => {
    prismaMock.investor.findMany.mockResolvedValue([]);
    prismaMock.kycInquiry.findMany.mockResolvedValue([
      {
        inquiryId: "inq_001",
        userId: "user-aaa",
        createdAt: new Date("2026-06-01T09:00:00Z"),
      },
      {
        inquiryId: "inq_002",
        userId: "user-bbb",
        createdAt: new Date("2026-06-02T09:00:00Z"),
      },
    ]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "kyc.review");
    expect(items).toHaveLength(2);

    const item = items.find((i) => i.id === "kyc-review-inq_001");
    expect(item).toBeDefined();
    expect(item?.severity).toBe("P1");
    expect(item?.href).toBe("/admin/customers");
    expect(item?.context).toContain("inq_001");
  });

  it("emits no kyc.review items when no pending inquiries exist", async () => {
    prismaMock.investor.findMany.mockResolvedValue([]);
    prismaMock.kycInquiry.findMany.mockResolvedValue([]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "kyc.review");
    expect(items).toHaveLength(0);
  });

  it("queries investor.findMany with kycStatus: approved to build the exclusion list", async () => {
    prismaMock.investor.findMany.mockResolvedValue([
      { userId: "user-approved" },
    ]);
    prismaMock.kycInquiry.findMany.mockResolvedValue([]);

    const { actionQueue } = await loadCockpitPayload();
    const items = actionQueue.filter((i) => i.type === "kyc.review");
    expect(items).toHaveLength(0);

    expect(prismaMock.investor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kycStatus: "approved" },
      }),
    );
  });
});
