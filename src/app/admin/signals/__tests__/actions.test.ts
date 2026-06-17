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
 * CAS regression lock (DB-3): the pending→executed transition uses updateMany
 * with a status:"pending" guard. A concurrent caller that loses the CAS race
 * (count===0) must NOT fire writeRebalanceEvent a second time.
 *
 * P2/P3 regression lock: the CAS where-clause now guards on BOTH status AND the
 * exact prior approvedBy snapshot. A count===0 partial-append racer retries with
 * a fresh read (no silent drop, no clobber). Audit + log fire on every successful
 * count===1 write (partial or threshold). If all MAX_ATTEMPTS exhaust, an
 * observable error is thrown — nothing is ever silently dropped.
 *
 * Mock strategy:
 * • requireAdmin               — vi.mock'd, controlled per test
 * • prisma.rebalanceEvent.*    — vi.mock'd (findUnique + updateMany)
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
      updateMany: vi.fn(),
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
import { recordAdminAudit } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";
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

type RebalanceEventRow = NonNullable<
  Awaited<ReturnType<typeof prisma.rebalanceEvent.findUnique>>
>;

/** A pending RebalanceEvent row. approvedBy is a JSON-encoded string array. */
function baseEvent(overrides: Partial<RebalanceEventRow> = {}): RebalanceEventRow {
  return {
    id: EVENT_ID,
    ruleId: "R2",
    vaultRef: "yield",
    triggerText: "BTC drawdown breached -15%",
    projection: "",
    status: "pending",
    approvedBy: "[]",
    executedAt: new Date("2026-01-01T00:00:00Z"),
    triggeredAt: new Date("2026-01-01T00:00:00Z"),
    actionText: "",
    impactText: "",
    sourceEventName: null,
    sourceEventId: null,
    fromAllocation: "{}",
    toAllocation: "{}",
    txHash: null,
    ...overrides,
  };
}

// ── beforeEach ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

// ── approveRebalance — multisig quorum on authenticated identity ──────────

describe("approveRebalance", () => {
  it("does NOT flip to executed when the SAME admin approves twice (idempotent, no second on-chain write)", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);

    eventMock().findUnique.mockResolvedValueOnce(baseEvent({ approvedBy: "[]" }));
    eventMock().updateMany.mockResolvedValueOnce({ count: 1 });

    await approveRebalance(EVENT_ID);

    expect(eventMock().updateMany).toHaveBeenCalledOnce();
    const firstCas = vi.mocked(eventMock().updateMany).mock
      .calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(firstCas.where).toMatchObject({ id: EVENT_ID, status: "pending" });
    expect(JSON.parse(firstCas.data.approvedBy as string)).toEqual([ADMIN_A.userId]);
    expect(firstCas.data.status).toBeUndefined();
    expect(chainMock()).not.toHaveBeenCalled();

    eventMock().findUnique.mockResolvedValueOnce(
      baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
    );

    await approveRebalance(EVENT_ID);

    expect(eventMock().updateMany).toHaveBeenCalledOnce();
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("reaches quorum when TWO DISTINCT admins approve → status executed, executedAt set, on-chain write fired once", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);
    eventMock().findUnique.mockResolvedValueOnce(baseEvent({ approvedBy: "[]" }));
    eventMock().updateMany.mockResolvedValueOnce({ count: 1 });

    await approveRebalance(EVENT_ID);

    const firstCas = vi.mocked(eventMock().updateMany).mock
      .calls[0]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(firstCas.data.status).toBeUndefined();
    expect(chainMock()).not.toHaveBeenCalled();

    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_B);
    eventMock().findUnique.mockResolvedValueOnce(
      baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
    );
    eventMock().updateMany.mockResolvedValueOnce({ count: 1 });

    await approveRebalance(EVENT_ID);

    const secondCas = vi.mocked(eventMock().updateMany).mock
      .calls[1]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(secondCas.where).toMatchObject({ id: EVENT_ID, status: "pending" });
    expect(secondCas.data.status).toBe("executed");
    expect(secondCas.data.executedAt).toBeInstanceOf(Date);
    expect(JSON.parse(secondCas.data.approvedBy as string)).toEqual([
      ADMIN_A.userId,
      ADMIN_B.userId,
    ]);

    expect(chainMock()).toHaveBeenCalledOnce();
    expect(chainMock()).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT_ID, ruleId: "R2" }),
    );
  });

  it("CAS race: loser retries, sees executed row, throws without on-chain write", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_B);

    eventMock().findUnique
      .mockResolvedValueOnce(
        baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
      )
      .mockResolvedValueOnce(
        baseEvent({
          status: "executed",
          approvedBy: JSON.stringify([ADMIN_A.userId, ADMIN_B.userId]),
        }),
      );
    eventMock().updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow(
      'Cannot approve a signal with status "executed"',
    );

    expect(eventMock().updateMany).toHaveBeenCalledOnce();
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("rejects approval on a non-pending event (already executed) and never writes on-chain", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);

    eventMock().findUnique.mockResolvedValue(
      baseEvent({
        status: "executed",
        approvedBy: JSON.stringify([ADMIN_A.userId, ADMIN_B.userId]),
      }),
    );

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow(
      'Cannot approve a signal with status "executed"',
    );

    expect(eventMock().updateMany).not.toHaveBeenCalled();
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("throws when the event does not exist", async () => {
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_A);

    eventMock().findUnique.mockResolvedValue(null);

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow("Not found");
    expect(chainMock()).not.toHaveBeenCalled();
  });

  it("requires admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow("Admin access required.");
    expect(eventMock().findUnique).not.toHaveBeenCalled();
    expect(chainMock()).not.toHaveBeenCalled();
  });

  // ── P2: concurrent partial-append retries on count=0 and succeeds ──────

  it("P2: concurrent partial-append racer retries on count=0 and succeeds — no lost signer, audit and log emitted on success", async () => {
    // Scenario: admins A and B both race to be the first signer.
    // B reads approvedBy=[] (pre-A-commit snapshot), issues CAS → count=0 (A won).
    // B retries: fresh read returns approvedBy=["admin_user_A"], CAS → count=1.
    // B's signer is stored. No silent drop. Audit + log fire on the winning attempt.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_B);

    // Attempt 1: read empty list, CAS loses.
    // Attempt 2 (retry): read A's write, CAS wins.
    eventMock().findUnique
      .mockResolvedValueOnce(baseEvent({ approvedBy: "[]" }))
      .mockResolvedValueOnce(
        baseEvent({ approvedBy: JSON.stringify([ADMIN_A.userId]) }),
      );
    eventMock().updateMany
      .mockResolvedValueOnce({ count: 0 })  // attempt 1 lost
      .mockResolvedValueOnce({ count: 1 }); // attempt 2 won

    await expect(approveRebalance(EVENT_ID)).resolves.toBeUndefined();

    // Two CAS attempts were made.
    expect(eventMock().updateMany).toHaveBeenCalledTimes(2);

    // Retry CAS where-clause uses the fresh approvedBy snapshot (P2: no clobber).
    const retryCas = vi.mocked(eventMock().updateMany).mock
      .calls[1]?.[0] as { where: Record<string, unknown>; data: Record<string, unknown> };
    expect(retryCas.where).toMatchObject({
      id: EVENT_ID,
      status: "pending",
      approvedBy: JSON.stringify([ADMIN_A.userId]),
    });
    // B is appended after A (no lost-update).
    expect(JSON.parse(retryCas.data.approvedBy as string)).toEqual([
      ADMIN_A.userId,
      ADMIN_B.userId,
    ]);
    // Threshold reached → status flipped.
    expect(retryCas.data.status).toBe("executed");

    // Audit was emitted exactly once on the successful attempt (P3 closed).
    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "rebalance.auto_executed", entityId: EVENT_ID }),
    );

    // On-chain write fired exactly once.
    expect(chainMock()).toHaveBeenCalledOnce();

    // logger.info emitted (not silently dropped — P3 closed).
    expect(vi.mocked(logger.info)).toHaveBeenCalledWith(
      "[signals] approve",
      expect.objectContaining({ signerKey: ADMIN_B.userId }),
    );
  });

  // ── P3: all MAX_ATTEMPTS exhaust → observable error, nothing silently dropped ─

  it("P3: exhausting all MAX_ATTEMPTS throws observable error — no silent signer drop", async () => {
    // Pathological case: every CAS attempt loses (count=0 every time, row never
    // settles). All 4 attempts exhaust → a clear concurrency error is thrown so
    // the failed approval is OBSERVABLE, never silently discarded.
    vi.mocked(requireAdmin).mockResolvedValue(ADMIN_B);

    // Always return a pending event (never changes — adversarial infinite contention).
    eventMock().findUnique.mockResolvedValue(baseEvent({ approvedBy: "[]" }));
    // Every CAS loses.
    eventMock().updateMany.mockResolvedValue({ count: 0 });

    await expect(approveRebalance(EVENT_ID)).rejects.toThrow(
      "Approval conflict — please retry",
    );

    // updateMany was called MAX_ATTEMPTS (4) times — never silently dropped.
    expect(eventMock().updateMany).toHaveBeenCalledTimes(4);

    // No audit row, no chain write — but the throw is observable.
    expect(vi.mocked(recordAdminAudit)).not.toHaveBeenCalled();
    expect(chainMock()).not.toHaveBeenCalled();
  });
});
