/**
 * Unit tests for src/lib/governance/actions.ts
 *
 * Mock strategy mirrors src/app/admin/vaults/__tests__/actions.test.ts:
 * • requireAdmin               — vi.mock'd, controlled per test
 * • prisma.*                   — vi.mock'd (inline factory, no hoisting issues)
 * • recordAdminAudit / logger  — silenced
 * • revalidatePath             — silenced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (factory form — no top-level variables; hoisting-safe) ──────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceProposal: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    proposalSignature: {
      create: vi.fn(),
    },
    vaultDeployment: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/governance/routing", () => ({
  routeForTransaction: vi.fn().mockResolvedValue({
    policy: { approveQuorum: 4, cancelQuorum: 2, timelockHours: 24, notifyBoard: true },
    isAllowlisted: false,
    allowlistEntry: null,
    reason: "test",
  }),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { routeForTransaction } from "@/lib/governance/routing";
import {
  proposeAction,
  signProposal,
  executeProposal,
  loadProposalQueue,
  loadProposalDetail,
} from "../actions";

// ── Typed mock accessors ─────────────────────────────────────────────────
// Use vi.mocked() to get typed mocks from the prisma object.

function govMock() {
  return vi.mocked(prisma.governanceProposal);
}
function sigMock() {
  return vi.mocked(prisma.proposalSignature);
}
function vaultMock() {
  return vi.mocked(prisma.vaultDeployment);
}

// ── Shared constants ─────────────────────────────────────────────────────

const ADMIN_USER = { userId: "0xAdminWallet", walletAddress: "0xAdminWallet" };
const VAULT_ID = "vault_cuid_001";
const PROPOSAL_ID = "prop_cuid_001";
// >80 chars
const JUSTIFICATION =
  "This change is necessary because the fee structure needs updating for the new regulatory framework that came into effect.";

function baseProposal(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: PROPOSAL_ID,
    vaultDeploymentId: VAULT_ID,
    actionType: "updateFees",
    calldata: null,
    justification: JUSTIFICATION,
    state: "SIGNING",
    proposedBy: ADMIN_USER.userId,
    requiredSigners: 3,
    cancelQuorum: 2,
    timelockHours: 48,
    graceWindowDays: 7,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    submittedAt: new Date("2026-01-01T00:00:00Z"),
    queuedAt: null,
    etaAt: new Date("2026-01-03T00:00:00Z"),
    executedAt: null,
    cancelledAt: null,
    signatures: [],
    vault: { ticker: "HYV-A" },
    ...overrides,
  };
}

// ── beforeEach ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER);
});

// ── proposeAction ────────────────────────────────────────────────────────

describe("proposeAction", () => {
  it("creates a proposal in SIGNING state", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vaultMock().findUnique as any).mockResolvedValue({
      id: VAULT_ID,
      requiredSigners: 3,
      ticker: "HYV-A",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().create as any).mockResolvedValue(baseProposal());

    const result = await proposeAction(VAULT_ID, "updateFees", undefined, JUSTIFICATION);

    expect(govMock().create).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (govMock().create as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.state).toBe("SIGNING");
    expect(result.state).toBe("SIGNING");
  });

  it("uses routing decision for requiredSigners and timelockHours", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vaultMock().findUnique as any).mockResolvedValue({
      id: VAULT_ID,
      requiredSigners: 3,
      ticker: "HYV-A",
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().create as any).mockResolvedValue(baseProposal());

    await proposeAction(VAULT_ID, "updateFees", undefined, JUSTIFICATION);

    // routeForTransaction must have been called with the correct actionType
    expect(vi.mocked(routeForTransaction)).toHaveBeenCalledOnce();
    expect(vi.mocked(routeForTransaction)).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "updateFees" }),
    );

    // Proposal must be created using routing policy values (4 / 24) not vault defaults
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (govMock().create as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.requiredSigners).toBe(4);
    expect(createCall.data.timelockHours).toBe(24);
  });

  it("throws if justification is < 80 chars", async () => {
    await expect(
      proposeAction(VAULT_ID, "pause", undefined, "Too short."),
    ).rejects.toThrow("Justification must be at least 80 characters");
  });

  it("throws if vault is not found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (vaultMock().findUnique as any).mockResolvedValue(null);

    await expect(
      proposeAction(VAULT_ID, "pause", undefined, JUSTIFICATION),
    ).rejects.toThrow("Vault not found");
  });

  it("requires admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      proposeAction(VAULT_ID, "pause", undefined, JUSTIFICATION),
    ).rejects.toThrow("Admin access required.");
  });
});

// ── signProposal ─────────────────────────────────────────────────────────

describe("signProposal", () => {
  it("records a signature and returns current state when quorum not met", async () => {
    const proposal = baseProposal({ state: "SIGNING", requiredSigners: 3, signatures: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sigMock().create as any).mockResolvedValue({});

    const state = await signProposal(PROPOSAL_ID, "approve");

    expect(sigMock().create).toHaveBeenCalledOnce();
    expect(state).toBe("SIGNING");
    expect(govMock().update).not.toHaveBeenCalled();
  });

  it("advances to TIMELOCK when approval quorum reached (3/3)", async () => {
    const proposal = baseProposal({
      state: "SIGNING",
      requiredSigners: 3,
      signatures: [
        { decision: "approve", signerAddress: "0xA" },
        { decision: "approve", signerAddress: "0xB" },
      ],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sigMock().create as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    const state = await signProposal(PROPOSAL_ID, "approve");

    expect(govMock().update).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (govMock().update as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updateCall.data.state).toBe("TIMELOCK");
    expect(updateCall.data.etaAt).toBeInstanceOf(Date);
    expect(state).toBe("TIMELOCK");
  });

  it("advances to REJECTED when 2 rejections", async () => {
    const proposal = baseProposal({
      state: "SIGNING",
      requiredSigners: 3,
      signatures: [{ decision: "reject", signerAddress: "0xA" }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sigMock().create as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    const state = await signProposal(PROPOSAL_ID, "reject");

    expect(state).toBe("REJECTED");
  });

  it("advances to CANCELLED when cancel quorum reached in TIMELOCK", async () => {
    const proposal = baseProposal({
      state: "TIMELOCK",
      cancelQuorum: 2,
      signatures: [{ decision: "cancel", signerAddress: "0xA" }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (sigMock().create as any).mockResolvedValue({});
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    const state = await signProposal(PROPOSAL_ID, "cancel");

    expect(state).toBe("CANCELLED");
  });

  it("rejects duplicate signature from same signer+decision", async () => {
    const proposal = baseProposal({
      state: "SIGNING",
      signatures: [{ decision: "approve", signerAddress: ADMIN_USER.userId }],
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);

    await expect(signProposal(PROPOSAL_ID, "approve")).rejects.toThrow("already submitted");
  });

  it("rejects cancel decision in SIGNING state", async () => {
    const proposal = baseProposal({ state: "SIGNING", signatures: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);

    await expect(signProposal(PROPOSAL_ID, "cancel")).rejects.toThrow(
      "Cannot cancel a proposal that is still in SIGNING state",
    );
  });

  it("rejects approve/reject in TIMELOCK state", async () => {
    const proposal = baseProposal({ state: "TIMELOCK", signatures: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);

    await expect(signProposal(PROPOSAL_ID, "approve")).rejects.toThrow(
      "Only 'cancel' decisions are accepted in TIMELOCK state",
    );
  });

  it("rejects any signature on terminal EXECUTED proposal", async () => {
    const proposal = baseProposal({ state: "EXECUTED", signatures: [] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);

    await expect(signProposal(PROPOSAL_ID, "cancel")).rejects.toThrow(
      "terminal state EXECUTED",
    );
  });
});

// ── executeProposal ──────────────────────────────────────────────────────

describe("executeProposal", () => {
  it("executes an EXECUTABLE proposal", async () => {
    // etaAt in the recent past (within grace window of 7 days)
    const recentPast = new Date(Date.now() - 60_000);
    const proposal = baseProposal({
      state: "EXECUTABLE",
      etaAt: recentPast,
      graceWindowDays: 7,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    const result = await executeProposal(PROPOSAL_ID);

    expect(result.executed).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (govMock().update as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updateCall.data.state).toBe("EXECUTED");
  });

  it("auto-advances TIMELOCK → EXECUTABLE when ETA passed, then executes", async () => {
    const past = new Date(Date.now() - 1000);
    const proposal = baseProposal({ state: "TIMELOCK", etaAt: past, graceWindowDays: 7 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    const result = await executeProposal(PROPOSAL_ID);

    expect(result.executed).toBe(true);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const first = (govMock().update as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(first.data.state).toBe("EXECUTABLE");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const second = (govMock().update as any).mock.calls[1]?.[0] as { data: Record<string, unknown> };
    expect(second.data.state).toBe("EXECUTED");
  });

  it("throws when proposal is SIGNING (not executable)", async () => {
    const proposal = baseProposal({ state: "SIGNING" });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);

    await expect(executeProposal(PROPOSAL_ID)).rejects.toThrow(
      "must be EXECUTABLE to execute",
    );
  });

  it("throws and marks EXPIRED when grace window elapsed", async () => {
    const longPast = new Date("2020-01-01T00:00:00Z");
    const proposal = baseProposal({
      state: "EXECUTABLE",
      etaAt: longPast,
      graceWindowDays: 7,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(proposal);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().update as any).mockResolvedValue({});

    await expect(executeProposal(PROPOSAL_ID)).rejects.toThrow("expired");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (govMock().update as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(updateCall.data.state).toBe("EXPIRED");
  });
});

// ── loadProposalQueue ────────────────────────────────────────────────────

describe("loadProposalQueue", () => {
  it("returns mapped proposal rows", async () => {
    const raw = [
      baseProposal({ signatures: [{ decision: "approve" }, { decision: "approve" }] }),
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findMany as any).mockResolvedValue(raw);

    const rows = await loadProposalQueue();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.approvalCount).toBe(2);
    expect(rows[0]!.state).toBe("SIGNING");
    expect(rows[0]!.vaultTicker).toBe("HYV-A");
  });
});

// ── loadProposalDetail ───────────────────────────────────────────────────

describe("loadProposalDetail", () => {
  it("returns full proposal detail with signatures", async () => {
    const sigRow = {
      id: "sig_001",
      signerAddress: "0xSigner1",
      decision: "approve",
      reason: null,
      signedAt: new Date("2026-01-01T01:00:00Z"),
    };
    const raw = baseProposal({ calldata: '{"fee": 300}', signatures: [sigRow] });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(raw);

    const detail = await loadProposalDetail(PROPOSAL_ID);

    expect(detail.calldata).toBe('{"fee": 300}');
    expect(detail.signatures).toHaveLength(1);
    expect(detail.signatures[0]!.decision).toBe("approve");
  });

  it("throws when proposal not found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (govMock().findUnique as any).mockResolvedValue(null);

    await expect(loadProposalDetail("nonexistent")).rejects.toThrow("Proposal not found");
  });
});
