/**
 * Unit tests for src/app/admin/signals/actions.ts — approveRebalance multisig.
 *
 * Regression lock for the deploy-blocker fix: the signer identity is derived
 * SERVER-SIDE from the authenticated admin (admin.walletAddress ?? admin.userId,
 * which collapses to userId for admins). It is NEVER a client-supplied value.
 * The multisig quorum therefore counts DISTINCT AUTHENTICATED ADMINS — the same
 * admin signing twice is idempotent and must NOT reach quorum, and the on-chain
 * write must fire exactly once when (and only when) two distinct admins approve.
 *
 * Mock strategy mirrors src/lib/governance/__tests__/actions.test.ts:
 * • requireAdmin               — vi.mock'd, controlled per test
 * • prisma.rebalanceEvent.*    — vi.mock'd (findUnique + update)
 * • writeRebalanceEvent        — vi.mock'd (the on-chain / oracle write)
 * • recordAdminAudit / logger  — silenced
 * • assertRateLimit            — resolves (no throttling in tests)
 * • revalidatePath             — silenced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (factory form — no top-level variables; hoisting-safe) ──────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    rebalanceEvent: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/chain/event-logger", () => ({
  writeRebalanceEvent: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { writeRebalanceEvent } from "@/lib/chain/event-logger";
import { approveRebalance } from "../actions";

// ── Typed mock accessors ─────────────────────────────────────────────────

function eventMock() {
  return vi.mocked(prisma.rebalanceEvent);
}
function chainMock() {
  return vi.mocked(writeRebalanceEvent);
}

// ── Shared constants ─────────────────────────────────────────────────────

const EVENT_ID = "rebalance_cuid_001";
// Admins have no Investor row, so walletAddress is undefined and the signer key
// collapses to userId. Use two DISTINCT authenticated admins.
const ADMIN_A = { userId: "admin_user_A" };
const ADMIN_B = { userId: "admin_user_B" };

/** A pending RebalanceEvent row. approvedBy is a JSON-encoded string array. */
function baseEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: EVENT_ID,
    ruleId: "R2",
    triggerText: "BTC drawdown breached -15%",
    projection: "",
    status: "pending",
    approvedBy: "[]",
    executedAt: new Date("2026-01-01T00:00:00Z"),
    triggeredAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

// ── beforeEach ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  // update() echoes back the data it was called with so `after` reflects state.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (eventMock().update as any).mockImplementation(
    async (args: { where: unknown; data: Record<string, unknown> }) => ({
      ...baseEvent(),
      ...args.data,
    }),
  );
});

// ── approveRebalance — multisig quorum on authenticated identity ──────────

describe("approveRebalance", () => {
  it("does NOT flip to executed when the SAME admin approves twice (idempotent, no second on-chain write)", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);

    // First approval: pending event, no signers yet.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(baseEvent({ approvedBy: "[]" }));

    await approveRebalance(EVENT_ID);

    // After first approval the event is still pending (quorum = 2, only 1 signer).
    expect(eventMock().update).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstUpdate = (eventMock().update as any).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(firstUpdate.data.status).toBe("pending");
    expect(JSON.parse(firstUpdate.data.approvedBy as string)).toEqual([ADMIN_A.userId]);
    expect(firstUpdate.data.executedAt).toBeUndefined();
    // No on-chain write below quorum.
    expect(chainMock()).not.toHaveBeenCalled();

    // Second approval by the SAME admin — the event now already carries their key.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(
      baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
    );

    await approveRebalance(EVENT_ID);

    // Idempotent short-circuit: NO further update, status never flips to executed,
    // and the on-chain / oracle write is NOT fired a second time.
    expect(eventMock().update).toHaveBeenCalledOnce(); // still only the first call
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("reaches quorum when TWO DISTINCT admins approve → status executed, executedAt set, on-chain write fired once", async () => {
    // First distinct admin signs the pending event.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(baseEvent({ approvedBy: "[]" }));

    await approveRebalance(EVENT_ID);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const firstUpdate = (eventMock().update as any).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(firstUpdate.data.status).toBe("pending");
    expect(chainMock()).not.toHaveBeenCalled();

    // Second DISTINCT admin signs — event now already carries admin A's key.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_B);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(
      baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
    );

    await approveRebalance(EVENT_ID);

    // Second update flips to executed with both distinct signers recorded.
    expect(eventMock().update).toHaveBeenCalledTimes(2);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const secondUpdate = (eventMock().update as any).mock.calls[1]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(secondUpdate.data.status).toBe("executed");
    expect(secondUpdate.data.executedAt).toBeInstanceOf(Date);
    expect(JSON.parse(secondUpdate.data.approvedBy as string)).toEqual([
      ADMIN_A.userId,
      ADMIN_B.userId,
    ]);

    // On-chain / oracle write fires exactly ONCE — at the quorum-reaching step.
    expect(chainMock()).toHaveBeenCalledOnce();
    expect(chainMock()).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT_ID, ruleId: "R2" }),
    );
  });

  it("rejects approval on a non-pending event (already executed) and never writes on-chain", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(
      baseEvent({ status: "executed", approvedBy: JSON.stringify([ADMIN_A.userId, ADMIN_B.userId]) }),
    );

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow(
      'Cannot approve a signal with status "executed"',
    );

    expect(eventMock().update).not.toHaveBeenCalled();
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("throws when the event does not exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (eventMock().findUnique as any).mockResolvedValue(null);

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow("Not found");
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("requires admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow("Admin access required.");
    expect(eventMock().findUnique).not.toHaveBeenCalled();
    expect(chainMock()).not.toHaveBeenCalled();
  });
});
