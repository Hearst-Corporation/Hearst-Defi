/**
 * Cockpit loader tests — src/lib/data/cockpit.ts.
 *
 * Covers:
 *   - the action-queue producers (multisig.sign, vault.paused,
 *     distribution.approve, kyc.review, rebalance.signal) emitting the correct
 *     ActionQueueItem when backing data exists, and nothing when empty;
 *   - the Loaded<T> honesty envelope: a DB failure yields
 *     `status: "unavailable"` — NEVER an empty array pretending the queue is
 *     clear or the trail is empty;
 *   - loader-borne provenance (queue = live derivation, audit = manual
 *     applicative INSERT) — the render layer never invents these.
 *
 * Mocking strategy: vi.hoisted() creates the mock object before vi.mock()
 * factories execute (vitest hoists vi.mock calls to the top of the file).
 *
 * server-only is stubbed so the module can be imported outside a Next.js
 * server environment.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

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
  adminAudit: { findMany: vi.fn().mockResolvedValue([]) },
}));

vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { loadCockpitPayload, type ActionQueueItem } from "@/lib/data/cockpit";
import type { Loaded } from "@/lib/data/admin-dashboard-cache";

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
  prismaMock.adminAudit.findMany.mockResolvedValue([]);
}

/** Unwrap a Loaded<T> the tests expect to be ok — fails loudly otherwise. */
function expectOk<T>(loaded: Loaded<T>): T {
  expect(loaded.status).toBe("ok");
  if (loaded.status !== "ok") throw new Error("expected ok");
  return loaded.data;
}

async function loadQueue(): Promise<ActionQueueItem[]> {
  const { actionQueue } = await loadCockpitPayload();
  return expectOk(actionQueue);
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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
        name: "Hearst Vault One",
        ticker: "HV1-A",
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

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "vault.paused");
    expect(items).toHaveLength(2);

    const first = items.find((i) => i.id === "vault-paused-vd-001");
    expect(first).toBeDefined();
    expect(first?.severity).toBe("P0");
    expect(first?.href).toBe("/admin/vaults/vd-001");
    expect(first?.title).toContain("Hearst Vault One");
    expect(first?.context).toBe("HV1-A · operator review required");
  });

  it("emits no vault.paused items when no paused vaults exist", async () => {
    prismaMock.vaultDeployment.findMany.mockResolvedValue([]);

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
    const item = actionQueue.find((i) => i.type === "vault.paused");
    expect(item?.createdAt).toBe(createdAt.toISOString());
  });
});

// ---------------------------------------------------------------------------
// 3. distribution.approve — DistributionApproval below threshold
// ---------------------------------------------------------------------------

describe("buildActionQueue — distribution.approve producer", () => {
  beforeEach(resetAllMocks);

  it("emits a legacy-payout item when a period has 1 of 2 approvals", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-06", _count: { signerWallet: 1 } },
    ]);

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(1);

    const item = items[0]!;
    expect(item.id).toBe("distribution-approve-2026-06");
    expect(item.severity).toBe("P1");
    expect(item.href).toBe("/admin/distributions");
    expect(item.context).toContain("1 of 2");
    // The threshold is hand-set (retired rail, no quorum source) — said so.
    expect(item.context).toContain("hand-set");
    // Rendered copy carries no banned product vocabulary.
    expect(item.title).toContain("Legacy payout");
  });

  it("emits no item when the period already has 2 of 2 approvals", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-05", _count: { signerWallet: 2 } },
    ]);

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(0);
  });

  it("emits no items when no approvals exist", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([]);

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "distribution.approve");
    expect(items).toHaveLength(0);
  });

  it("emits one item per pending period, skips periods at threshold", async () => {
    prismaMock.distributionApproval.groupBy.mockResolvedValue([
      { period: "2026-04", _count: { signerWallet: 1 } },
      { period: "2026-05", _count: { signerWallet: 2 } }, // threshold met — no item
      { period: "2026-06", _count: { signerWallet: 1 } },
    ]);

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
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

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "kyc.review");
    expect(items).toHaveLength(0);
  });

  it("queries investor.findMany with kycStatus: approved to build the exclusion list", async () => {
    prismaMock.investor.findMany.mockResolvedValue([
      { userId: "user-approved" },
    ]);
    prismaMock.kycInquiry.findMany.mockResolvedValue([]);

    const actionQueue = await loadQueue();
    const items = actionQueue.filter((i) => i.type === "kyc.review");
    expect(items).toHaveLength(0);

    expect(prismaMock.investor.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { kycStatus: "approved" },
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// 5. Loaded envelope — a DB failure is `unavailable`, never an empty array
// ---------------------------------------------------------------------------

describe("loadCockpitPayload — Loaded honesty envelope", () => {
  beforeEach(resetAllMocks);

  it("action queue reports unavailable (not []) when a DB read throws", async () => {
    prismaMock.governanceProposal.findMany.mockRejectedValue(
      new Error("connection refused"),
    );

    const { actionQueue, auditTrail } = await loadCockpitPayload();
    expect(actionQueue.status).toBe("unavailable");
    if (actionQueue.status === "unavailable") {
      expect(actionQueue.reason).toBe("db_error");
      expect(actionQueue.detail).toContain("connection refused");
    }
    // The audit read is independent — it still succeeds here.
    expect(auditTrail.status).toBe("ok");
  });

  it("audit trail reports unavailable (not []) when its DB read throws", async () => {
    prismaMock.adminAudit.findMany.mockRejectedValue(new Error("db down"));

    const { actionQueue, auditTrail } = await loadCockpitPayload();
    expect(auditTrail.status).toBe("unavailable");
    if (auditTrail.status === "unavailable") {
      expect(auditTrail.reason).toBe("db_error");
    }
    expect(actionQueue.status).toBe("ok");
  });

  it("an empty DB is ok+[] — distinct from unavailable", async () => {
    const { actionQueue, auditTrail } = await loadCockpitPayload();
    expect(expectOk(actionQueue).filter((i) => i.type !== "oracle.stale")).toEqual([]);
    expect(expectOk(auditTrail)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6. Loader-borne provenance — the render layer never invents it
// ---------------------------------------------------------------------------

describe("loadCockpitPayload — loader-borne provenance", () => {
  beforeEach(resetAllMocks);

  it("every queue item carries provenance 'live' (fresh DB derivation)", async () => {
    prismaMock.vaultDeployment.findMany.mockResolvedValue([
      {
        id: "vd-010",
        name: "Paused Vault",
        ticker: "PSD-A",
        status: "paused",
        pausedAt: new Date("2026-06-05T12:00:00Z"),
        createdAt: new Date("2026-05-01T00:00:00Z"),
      },
    ]);

    const actionQueue = await loadQueue();
    expect(actionQueue.length).toBeGreaterThan(0);
    for (const item of actionQueue) {
      expect(item.provenance).toBe("live");
    }
  });

  it("audit entries carry provenance 'manual' (applicative INSERT, not attested)", async () => {
    prismaMock.adminAudit.findMany.mockResolvedValue([
      {
        id: "aud-1",
        occurredAt: new Date("2026-06-01T10:00:00Z"),
        actorWallet: "0xAA",
        action: "vault.pause",
        entityType: "VaultDeployment",
        entityId: "vd-1",
      },
    ]);

    const { auditTrail } = await loadCockpitPayload();
    const entries = expectOk(auditTrail);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.provenance).toBe("manual");
  });
});
