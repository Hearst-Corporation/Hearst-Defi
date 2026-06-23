/**
 * Unit tests for src/lib/inngest/functions/outreach-auto-send.ts — the GOVERNED
 * autonomous first-touch sender (ADR-016). This is the path that must NEVER send
 * accidentally.
 *
 * Resend is mocked at the @/lib/email/send boundary — no real fetch, no real
 * email. Prisma + env are mocked so we can drive OUTREACH_AUTONOMY per test.
 *
 * Asserts the core safety invariants:
 *   - SUGGEST (the safe default) short-circuits → ZERO sends, no DB work
 *   - Tier A is NEVER auto-sent, even at SEND
 *   - Tier B/C ARE auto-sent at SEND, within the warm-up budget
 *   - a recipient suppressed after drafting is skipped at send time
 *   - the forbidden-words guard blocks a tampered draft body before send
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTrackedEmailMock = vi.fn<(opts: { to: string }) => Promise<{ id: string }>>(
  async () => ({ id: "resend_mock_id" }),
);
const isSuppressedMock = vi.fn<(email: string) => Promise<boolean>>(async () => false);

const emailFindFirstMock = vi.fn<() => Promise<{ sentAt: Date } | null>>(async () => null); // warm-up clock anchor
const emailCountMock = vi.fn<() => Promise<number>>(async () => 0); // sentToday
const emailFindManyMock = vi.fn<() => Promise<unknown[]>>(async () => []); // candidate drafts
const emailUpdateMock = vi.fn(async () => ({}));
const prospectUpdateMock = vi.fn(async () => ({}));
const auditCreateMock = vi.fn(async () => ({}));
const txMock = vi.fn(async (ops: unknown[]) => ops);

// Mutable env the handler reads — each test sets autonomy/cap.
const mockEnv: { OUTREACH_AUTONOMY: string; OUTREACH_DAILY_SEND_CAP: number } = {
  OUTREACH_AUTONOMY: "SUGGEST",
  OUTREACH_DAILY_SEND_CAP: 30,
};

vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/email/send", () => ({
  sendTrackedEmail: sendTrackedEmailMock,
  renderPlainHtml: (body: string) => `<html>${body}</html>`,
}));

vi.mock("@/lib/outreach/suppression", () => ({ isSuppressed: isSuppressedMock }));

vi.mock("@/lib/hubspot/sync-prospect", () => ({
  logEmailActivity: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachEmail: {
      findFirst: emailFindFirstMock,
      count: emailCountMock,
      findMany: emailFindManyMock,
      update: emailUpdateMock,
    },
    outreachProspect: { update: prospectUpdateMock },
    adminAudit: { create: auditCreateMock },
    $transaction: txMock,
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function buildStepShim() {
  return {
    run: <T,>(_name: string, fn: () => T | Promise<T>): Promise<T> => Promise.resolve(fn()),
  };
}

/** A draftedByAgent candidate row as loaded by the handler. */
function draft(i: number, tier: "A" | "B" | "C", over: Partial<{ toEmail: string; body: string }> = {}) {
  return {
    id: `email_${i}`,
    toEmail: over.toEmail ?? `r${i}@example.com`,
    subject: `Subject ${i}`,
    body: over.body ?? `Hello, a compliant institutional note ${i}.`,
    prospectId: `prospect_${i}`,
    prospect: { tier, lastContactedAt: null },
  };
}

describe("outreachAutoSendHandler — governed autonomous sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.OUTREACH_AUTONOMY = "SUGGEST";
    mockEnv.OUTREACH_DAILY_SEND_CAP = 30;
    isSuppressedMock.mockResolvedValue(false);
    emailFindFirstMock.mockResolvedValue(null);
    emailCountMock.mockResolvedValue(0);
    sendTrackedEmailMock.mockResolvedValue({ id: "resend_mock_id" });
  });

  it("SUGGEST short-circuits → zero sends and no candidate query", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SUGGEST";
    emailFindManyMock.mockResolvedValue([draft(0, "B")]); // would be eligible if reached
    const { outreachAutoSendHandler } = await import("@/lib/inngest/functions/outreach-auto-send");

    const res = await outreachAutoSendHandler({ step: buildStepShim(), now: new Date("2026-06-23T10:00:00Z") });

    expect(res).toEqual({ autonomy: "SUGGEST", budget: 0, sent: 0, suppressed: 0, failed: 0, skippedIneligible: 0 });
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(emailFindManyMock).not.toHaveBeenCalled(); // short-circuit before any DB work
  });

  it("Tier A is NEVER auto-sent, even at SEND", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    emailFindManyMock.mockResolvedValue([draft(0, "A"), draft(1, "A")]);
    const { outreachAutoSendHandler } = await import("@/lib/inngest/functions/outreach-auto-send");

    const res = await outreachAutoSendHandler({ step: buildStepShim(), now: new Date("2026-06-23T10:00:00Z") });

    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(res.sent).toBe(0);
    expect(res.skippedIneligible).toBe(2);
  });

  it("Tier B/C ARE auto-sent at SEND, within the day-0 warm-up budget (10)", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    emailFindManyMock.mockResolvedValue([draft(0, "B"), draft(1, "C")]);
    const { outreachAutoSendHandler } = await import("@/lib/inngest/functions/outreach-auto-send");

    const res = await outreachAutoSendHandler({ step: buildStepShim(), now: new Date("2026-06-23T10:00:00Z") });

    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(2);
    expect(res.sent).toBe(2);
    expect(res.skippedIneligible).toBe(0);
    // tier + autonomy stamped on the sent rows (via $transaction)
    expect(txMock).toHaveBeenCalled();
  });

  it("re-checks suppression at send time and skips the opted-out address", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    emailFindManyMock.mockResolvedValue([draft(0, "B", { toEmail: "opted@example.com" }), draft(1, "C")]);
    isSuppressedMock.mockImplementation(async (email: string) => email === "opted@example.com");
    const { outreachAutoSendHandler } = await import("@/lib/inngest/functions/outreach-auto-send");

    const res = await outreachAutoSendHandler({ step: buildStepShim(), now: new Date("2026-06-23T10:00:00Z") });

    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "r1@example.com" }));
    expect(res.sent).toBe(1);
    expect(res.suppressed).toBe(1);
  });

  it("the forbidden-words guard blocks a tampered draft body before send", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    emailFindManyMock.mockResolvedValue([
      draft(0, "B", { body: "We offer an assured return, risk-free." }),
      draft(1, "C"),
    ]);
    const { outreachAutoSendHandler } = await import("@/lib/inngest/functions/outreach-auto-send");

    const res = await outreachAutoSendHandler({ step: buildStepShim(), now: new Date("2026-06-23T10:00:00Z") });

    // The compliant one sends; the tampered one is caught by assertNoForbiddenWords → failed
    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "r1@example.com" }));
    expect(res.failed).toBe(1);
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_0" }, data: { status: "failed" } }),
    );
  });
});
