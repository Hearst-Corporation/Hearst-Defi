/**
 * Unit tests for src/lib/inngest/functions/distribution-executed.ts
 *
 * Coverage:
 *   - One fetch per unique investor email (dedupe: N positions → 1 email, summed amount)
 *   - Recipients with null email are skipped (counted, not thrown)
 *   - Duplicate invocations short-circuit via idempotency (isDuplicate → true)
 *   - Missing RESEND_API_KEY → returns { skipped: true }, does NOT throw
 *   - Per-recipient step IDs are stable (send-email-0, send-email-1, …)
 *   - On-chain mirror step fires exactly once
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks (declared before module import)
// ---------------------------------------------------------------------------

const llmRunFindFirstMock = vi.fn(async () => null);
const llmRunCreateMock = vi.fn(async () => ({ id: "mock-llm-run-id" }));

const distributionLedgerEntryFindManyMock = vi.fn();
const positionFindUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    distributionLedgerEntry: {
      findMany: distributionLedgerEntryFindManyMock,
    },
    position: {
      findUnique: positionFindUniqueMock,
    },
    llmRun: {
      findFirst: llmRunFindFirstMock,
      create: llmRunCreateMock,
    },
  },
}));

// Idempotency mock — default: not a duplicate
const isDuplicateMock = vi.fn(async () => false);
const markCompleteMock = vi.fn(async () => undefined);

vi.mock("@/lib/idempotency", () => ({
  isDuplicate: isDuplicateMock,
  markComplete: markCompleteMock,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("@/lib/chain/event-logger", () => ({
  writeHearstEvent: vi.fn(async () => null),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a fake DistributionExecutedPayload event */
function buildEvent(distributionId = "dist_001", period = "2026-05", amountUsdc = 10_000) {
  return {
    data: { distributionId, period, amountUsdc, ledgerEntriesCount: 2, txHash: "0xMOCK", executedAt: new Date().toISOString() },
  };
}

/**
 * Step shim that executes fn() and records which step names were called.
 * The `stepNames` array is populated during each test so assertions can
 * verify stable per-recipient IDs.
 */
function buildStepShim() {
  const stepNames: string[] = [];
  const shim = {
    stepNames,
    run: <T,>(name: string, fn: () => T | Promise<T>): Promise<T> => {
      stepNames.push(name);
      return Promise.resolve(fn());
    },
  };
  return shim;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("distributionExecutedHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isDuplicateMock.mockResolvedValue(false);
    // Restore RESEND_API_KEY for most tests
    process.env.RESEND_API_KEY = "re_test_key";
    // Default fetch mock: always succeeds
    global.fetch = vi.fn(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 })) as unknown as typeof fetch;
  });

  it("registers with id 'distribution-executed'", async () => {
    const { distributionExecuted, DISTRIBUTION_EXECUTED_ID } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );
    expect(DISTRIBUTION_EXECUTED_ID).toBe("distribution-executed");
    expect(distributionExecuted.opts.id).toBe("distribution-executed");
  });

  it("triggers on distribution.executed event", async () => {
    const { distributionExecuted } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );
    const triggers = distributionExecuted.opts.triggers;
    expect(triggers).toHaveLength(1);
    const trigger = triggers?.[0];
    if (!trigger || !("event" in trigger)) {
      throw new Error("Expected an event trigger on distributionExecuted.");
    }
    expect(trigger.event).toBe("distribution.executed");
  });

  it("sends one fetch per unique investor email (two distinct investors)", async () => {
    distributionLedgerEntryFindManyMock.mockResolvedValue([
      { positionId: "pos_1", amountUsdc: 5_000 },
      { positionId: "pos_2", amountUsdc: 5_000 },
    ]);

    positionFindUniqueMock
      .mockResolvedValueOnce({ investor: { email: "alice@example.com" } })
      .mockResolvedValueOnce({ investor: { email: "bob@example.com" } });

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const stepShim = buildStepShim();
    const result = await distributionExecutedHandler({
      step: stepShim,
      event: buildEvent(),
    });

    // Two distinct investors → two send-email-<i> steps + one load-recipients step
    // + one mirror-onchain-distribution step
    expect(stepShim.stepNames).toContain("load-recipients");
    expect(stepShim.stepNames).toContain("send-email-0");
    expect(stepShim.stepNames).toContain("send-email-1");

    expect(global.fetch).toHaveBeenCalledTimes(2);
    expect("skipped" in result).toBe(false);
    if (!("emailsSent" in result)) throw new Error("Expected emailsSent in result");
    expect(result.emailsSent).toBe(2);
    expect(result.skippedNoEmail).toBe(0);
  });

  it("dedupes by investor: 2 positions same investor → exactly 1 email with summed amount", async () => {
    distributionLedgerEntryFindManyMock.mockResolvedValue([
      { positionId: "pos_1", amountUsdc: 3_000 },
      { positionId: "pos_2", amountUsdc: 7_000 },
    ]);

    // Both positions belong to the same investor email
    positionFindUniqueMock
      .mockResolvedValueOnce({ investor: { email: "alice@example.com" } })
      .mockResolvedValueOnce({ investor: { email: "alice@example.com" } });

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const stepShim = buildStepShim();
    const result = await distributionExecutedHandler({
      step: stepShim,
      event: buildEvent(),
    });

    // Only ONE send-email step
    expect(stepShim.stepNames).toContain("send-email-0");
    expect(stepShim.stepNames).not.toContain("send-email-1");

    // Only ONE email must be sent (not two)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    if (!("emailsSent" in result)) throw new Error("Expected emailsSent in result");
    expect(result.emailsSent).toBe(1);
    expect(result.skippedNoEmail).toBe(0);

    // The single email must carry the SUMMED amount (3000 + 7000 = 10000)
    const fetchCall = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(fetchCall).toBeDefined();
    const body = JSON.parse((fetchCall![1] as RequestInit).body as string) as { html: string };
    expect(body.html).toContain("10,000.00");
  });

  it("skips recipients with null email, does not throw", async () => {
    distributionLedgerEntryFindManyMock.mockResolvedValue([
      { positionId: "pos_1", amountUsdc: 5_000 },
      { positionId: "pos_2", amountUsdc: 5_000 },
      { positionId: "pos_3", amountUsdc: 2_000 },
    ]);

    positionFindUniqueMock
      .mockResolvedValueOnce({ investor: { email: "alice@example.com" } })
      .mockResolvedValueOnce({ investor: { email: null } })       // null email
      .mockResolvedValueOnce({ investor: null });                  // no investor

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const result = await distributionExecutedHandler({
      step: buildStepShim(),
      event: buildEvent(),
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    if (!("emailsSent" in result)) throw new Error("Expected emailsSent in result");
    expect(result.emailsSent).toBe(1);
    expect(result.skippedNoEmail).toBe(2);
  });

  it("short-circuits when isDuplicate returns true", async () => {
    isDuplicateMock.mockResolvedValue(true);

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const result = await distributionExecutedHandler({
      step: buildStepShim(),
      event: buildEvent(),
    });

    expect("skipped" in result && result.skipped).toBe(true);
    // No DB or fetch calls made
    expect(distributionLedgerEntryFindManyMock).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns { skipped: true } when RESEND_API_KEY is missing — does not throw", async () => {
    delete process.env.RESEND_API_KEY;

    distributionLedgerEntryFindManyMock.mockResolvedValue([
      { positionId: "pos_1", amountUsdc: 5_000 },
    ]);

    positionFindUniqueMock.mockResolvedValue({
      investor: { email: "alice@example.com" },
    });

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const result = await distributionExecutedHandler({
      step: buildStepShim(),
      event: buildEvent(),
    });

    // Must NOT throw, must return skipped
    expect("skipped" in result && result.skipped).toBe(true);
    // No email sent
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("on-chain mirror step fires exactly once per distribution", async () => {
    distributionLedgerEntryFindManyMock.mockResolvedValue([]);
    positionFindUniqueMock.mockResolvedValue(null);

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const stepShim = buildStepShim();
    await distributionExecutedHandler({
      step: stepShim,
      event: buildEvent(),
    });

    // mirror-onchain-distribution must appear exactly once
    const mirrorCalls = stepShim.stepNames.filter(
      (n) => n === "mirror-onchain-distribution",
    );
    expect(mirrorCalls).toHaveLength(1);
  });

  it("send-email step IDs are stable (sorted by email) across invocations", async () => {
    // Two investors: bob comes before alice alphabetically → alice is index 0 after sort
    distributionLedgerEntryFindManyMock.mockResolvedValue([
      { positionId: "pos_1", amountUsdc: 1_000 },
      { positionId: "pos_2", amountUsdc: 2_000 },
    ]);

    positionFindUniqueMock
      .mockResolvedValueOnce({ investor: { email: "bob@example.com" } })
      .mockResolvedValueOnce({ investor: { email: "alice@example.com" } });

    const { distributionExecutedHandler } = await import(
      "@/lib/inngest/functions/distribution-executed"
    );

    const stepShim = buildStepShim();
    const result = await distributionExecutedHandler({
      step: stepShim,
      event: buildEvent(),
    });

    // After sort: alice@example.com (index 0), bob@example.com (index 1)
    expect(stepShim.stepNames).toContain("send-email-0");
    expect(stepShim.stepNames).toContain("send-email-1");

    if (!("emailsSent" in result)) throw new Error("Expected emailsSent in result");
    expect(result.emailsSent).toBe(2);

    // First fetch call should be to alice (lower sort order)
    const fetchCalls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
    const firstBody = JSON.parse((fetchCalls[0]![1] as RequestInit).body as string) as { to: string[] };
    expect(firstBody.to[0]).toBe("alice@example.com");
  });
});
