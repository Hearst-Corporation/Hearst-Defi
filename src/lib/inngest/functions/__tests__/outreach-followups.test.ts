/**
 * Unit tests for src/lib/inngest/functions/outreach-followups.ts — the daily
 * follow-up cadence (NURTURE+ only). Focus of this suite: the forbidden-words
 * send-time gate + its audit trail (parity with outreach-send / auto-send).
 *
 * Resend is mocked at @/lib/email/send; draftColdEmail, env, suppression, db,
 * and recordAdminAudit's prisma are mocked so we can drive what the agent
 * "drafts" and assert what is (not) sent + what is audited.
 *
 * Asserts:
 *   - NURTURE → a clean follow-up is drafted, sent, prospect advanced
 *   - a forbidden-word draft is NEVER sent, row persisted "failed", audited
 *   - the audit payload carries the matched terms + channel, NOT the full body
 *   - suppression still drops the prospect out of cadence (unchanged)
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTrackedEmailMock = vi.fn<(opts: { to: string }) => Promise<{ id: string }>>(
  async () => ({ id: "resend_mock_id" }),
);
const isSuppressedMock = vi.fn<(email: string) => Promise<boolean>>(async () => false);
const draftColdEmailMock = vi.fn<() => Promise<{ subject: string; body: string }>>(
  async () => ({ subject: "Following up", body: "A short, compliant nudge." }),
);

const prospectFindManyMock = vi.fn<() => Promise<unknown[]>>(async () => []);
const prospectUpdateMock = vi.fn(async () => ({}));
const icpFindManyMock = vi.fn<() => Promise<unknown[]>>(async () => []);
const campaignFindFirstMock = vi.fn<() => Promise<{ id: string } | null>>(async () => ({ id: "camp_followup" }));
const campaignCreateMock = vi.fn(async () => ({ id: "camp_followup" }));
const emailCreateMock = vi.fn(async () => ({ id: "email_new" }));
const emailUpdateMock = vi.fn(async () => ({}));
const auditCreateMock = vi.fn(async (_args: { data: { action: string; entityType: string; entityId: string; diff: string } }) => ({}));
const txMock = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
  fn({
    outreachEmail: { update: emailUpdateMock },
    outreachProspect: { update: prospectUpdateMock },
    adminAudit: { create: auditCreateMock },
  }),
);

const mockEnv: { OUTREACH_AUTONOMY: string } = { OUTREACH_AUTONOMY: "NURTURE" };
vi.mock("@/lib/env", () => ({ env: mockEnv }));

vi.mock("@/lib/email/send", () => ({
  sendTrackedEmail: sendTrackedEmailMock,
  renderPlainHtml: (body: string) => `<html>${body}</html>`,
}));

vi.mock("@/lib/outreach/suppression", () => ({ isSuppressed: isSuppressedMock }));

vi.mock("@/lib/agents/outreach-writer", () => ({
  draftColdEmail: draftColdEmailMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachProspect: { findMany: prospectFindManyMock, update: prospectUpdateMock },
    outreachICP: { findMany: icpFindManyMock },
    outreachCampaign: { findFirst: campaignFindFirstMock, create: campaignCreateMock },
    outreachEmail: { create: emailCreateMock, update: emailUpdateMock },
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

/** A prospect due for a follow-up (step 1, contacted long ago). */
function dueProspect(over: Partial<{ id: string; email: string }> = {}) {
  return {
    id: over.id ?? "prospect_1",
    email: over.email ?? "lead@example.com",
    firstName: "Alice",
    lastName: "Doe",
    company: "Acme",
    title: "Partner",
    tier: "B",
    sequenceStep: 1,
    // 60 days ago → well past any step delay.
    lastContactedAt: new Date("2026-01-01T00:00:00.000Z"),
    icpId: null,
  };
}

const NOW = new Date("2026-03-15T00:00:00.000Z");

describe("outreachFollowupsHandler — forbidden-words gate + audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv.OUTREACH_AUTONOMY = "NURTURE";
    isSuppressedMock.mockResolvedValue(false);
    sendTrackedEmailMock.mockResolvedValue({ id: "resend_mock_id" });
    draftColdEmailMock.mockResolvedValue({ subject: "Following up", body: "A short, compliant nudge." });
    campaignFindFirstMock.mockResolvedValue({ id: "camp_followup" });
    emailCreateMock.mockResolvedValue({ id: "email_new" });
    icpFindManyMock.mockResolvedValue([]);
  });

  it("sends a clean follow-up at NURTURE and advances the prospect", async () => {
    prospectFindManyMock.mockResolvedValue([dueProspect()]);
    const { outreachFollowupsHandler } = await import("@/lib/inngest/functions/outreach-followups");

    const res = await outreachFollowupsHandler({ step: buildStepShim(), now: NOW });

    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(res).toMatchObject({ autonomy: "NURTURE", sent: 1, failed: 0 });
    // The "sent" audit (existing behaviour) is recorded, not a block.
    expect(auditCreateMock).toHaveBeenCalled();
  });

  it("does nothing at SUGGEST (below NURTURE) — no draft, no send", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SUGGEST";
    prospectFindManyMock.mockResolvedValue([dueProspect()]);
    const { outreachFollowupsHandler } = await import("@/lib/inngest/functions/outreach-followups");

    const res = await outreachFollowupsHandler({ step: buildStepShim(), now: NOW });

    expect(res).toEqual({ autonomy: "SUGGEST", due: 0, sent: 0, suppressed: 0, failed: 0 });
    expect(draftColdEmailMock).not.toHaveBeenCalled();
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });

  it("blocks a forbidden-word follow-up: NOT sent, persisted failed, audited", async () => {
    prospectFindManyMock.mockResolvedValue([dueProspect()]);
    // The agent draft slips an unconditional claim through.
    draftColdEmailMock.mockResolvedValue({
      subject: "A guaranteed opportunity",
      body: "This follow-up promises risk-free, guaranteed returns.",
    });
    const { outreachFollowupsHandler } = await import("@/lib/inngest/functions/outreach-followups");

    const res = await outreachFollowupsHandler({ step: buildStepShim(), now: NOW });

    // Never sent.
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    // Persisted as a "failed" row (existing status, no new model).
    expect(emailCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed", prospectId: "prospect_1" }),
      }),
    );
    // Counted as failed (a blocked follow-up is not a send).
    expect(res).toMatchObject({ sent: 0, failed: 1 });

    // Audited: action outreach.blockedSend, channel followup, reason
    // forbidden_words, with matched terms — and NEVER the full body.
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditArg = auditCreateMock.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("outreach.blockedSend");
    expect(auditArg.data.entityType).toBe("OutreachEmail");
    const diff = JSON.parse(auditArg.data.diff) as {
      after: { reason: string; channel: string; found: string[] };
    };
    expect(diff.after.reason).toBe("forbidden_words");
    expect(diff.after.channel).toBe("followup");
    expect(Array.isArray(diff.after.found)).toBe(true);
    expect(auditArg.data.diff).not.toContain("This follow-up promises risk-free, guaranteed returns.");
  });

  it("suppression still drops a suppressed prospect out of cadence (unchanged)", async () => {
    prospectFindManyMock.mockResolvedValue([dueProspect()]);
    isSuppressedMock.mockResolvedValue(true);
    const { outreachFollowupsHandler } = await import("@/lib/inngest/functions/outreach-followups");

    const res = await outreachFollowupsHandler({ step: buildStepShim(), now: NOW });

    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(draftColdEmailMock).not.toHaveBeenCalled();
    expect(prospectUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "prospect_1" }, data: { status: "opted_out" } }),
    );
    expect(res).toMatchObject({ suppressed: 1, sent: 0 });
  });
});
