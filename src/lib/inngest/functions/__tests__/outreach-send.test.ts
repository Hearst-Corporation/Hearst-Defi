/**
 * Unit tests for src/lib/inngest/functions/outreach-send.ts — the campaign
 * fan-out sender (human-approved path; NOT autonomy-gated by design — the gate
 * is the upstream approveEmail step).
 *
 * Resend is mocked at the @/lib/email/send boundary — no real fetch, no real
 * email. Prisma is mocked. Asserts:
 *   - one send per approved email; campaign flipped to "sent"
 *   - a recipient suppressed AFTER approval is skipped (status "failed"), never sent
 *   - a Resend error marks the row "failed" and the fan-out continues
 *   - no approved emails → { skipped: true }, zero sends
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTrackedEmailMock = vi.fn<(opts: { to: string }) => Promise<{ id: string }>>(
  async () => ({ id: "resend_mock_id" }),
);
const isSuppressedMock = vi.fn<(email: string) => Promise<boolean>>(async () => false);

const emailFindManyMock = vi.fn<() => Promise<unknown[]>>(async () => []);
const emailUpdateMock = vi.fn(async () => ({}));
const campaignUpdateMock = vi.fn(async () => ({}));
const auditCreateMock = vi.fn(async (_args: { data: { action: string; entityType: string; entityId: string; diff: string } }) => ({}));

vi.mock("@/lib/email/send", () => ({
  sendTrackedEmail: sendTrackedEmailMock,
  renderPlainHtml: (body: string) => `<html>${body}</html>`,
}));

vi.mock("@/lib/outreach/suppression", () => ({
  isSuppressed: isSuppressedMock,
}));

vi.mock("@/lib/hubspot/sync-prospect", () => ({
  logEmailActivity: vi.fn(async () => undefined),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachEmail: { findMany: emailFindManyMock, update: emailUpdateMock },
    outreachCampaign: { update: campaignUpdateMock },
    adminAudit: { create: auditCreateMock },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function buildStepShim() {
  const stepNames: string[] = [];
  return {
    stepNames,
    run: <T,>(name: string, fn: () => T | Promise<T>): Promise<T> => {
      stepNames.push(name);
      return Promise.resolve(fn());
    },
  };
}

function approvedRow(i: number, over: Partial<{ toEmail: string; prospectId: string | null }> = {}) {
  return {
    id: `email_${i}`,
    toEmail: over.toEmail ?? `r${i}@example.com`,
    subject: `Subject ${i}`,
    body: `Body ${i}`,
    prospectId: over.prospectId ?? `prospect_${i}`,
  };
}

describe("outreachSendHandler — campaign fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSuppressedMock.mockResolvedValue(false);
    sendTrackedEmailMock.mockResolvedValue({ id: "resend_mock_id" });
  });

  it("sends one email per approved row and flips the campaign to sent", async () => {
    emailFindManyMock.mockResolvedValue([approvedRow(0), approvedRow(1)]);
    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const step = buildStepShim();

    const res = await outreachSendHandler({ step, event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } } });

    expect(res).toEqual({ sent: 2, failed: 0, total: 2 });
    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(2);
    // campaign flipped to "sent"
    expect(campaignUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "camp_1" }, data: expect.objectContaining({ status: "sent" }) }),
    );
    // stable per-recipient step ids
    expect(step.stepNames).toEqual(
      expect.arrayContaining(["send-email-0", "send-email-1", "mark-campaign-sent"]),
    );
  });

  it("skips a recipient suppressed after approval — never calls Resend for it", async () => {
    emailFindManyMock.mockResolvedValue([approvedRow(0), approvedRow(1)]);
    // r0 is suppressed, r1 is fine
    isSuppressedMock.mockImplementation(async (email: string) => email === "r0@example.com");

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({ step: buildStepShim(), event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } } });

    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(expect.objectContaining({ to: "r1@example.com" }));
    // suppressed row marked failed (compliance), not sent
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_0" }, data: { status: "failed" } }),
    );
    expect(res).toEqual({ sent: 1, failed: 1, total: 2 });
  });

  it("a Resend error marks the row failed and the fan-out continues", async () => {
    emailFindManyMock.mockResolvedValue([approvedRow(0), approvedRow(1)]);
    sendTrackedEmailMock
      .mockRejectedValueOnce(new Error("Resend API error 500"))
      .mockResolvedValueOnce({ id: "resend_ok" });

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({ step: buildStepShim(), event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } } });

    expect(res).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_0" }, data: { status: "failed" } }),
    );
  });

  it("no approved emails → skipped, zero sends, campaign untouched", async () => {
    emailFindManyMock.mockResolvedValue([]);
    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({ step: buildStepShim(), event: { data: { campaignId: "camp_empty", requestedBy: "0xadmin" } } });

    expect(res).toEqual({ skipped: true, reason: "no_approved_emails" });
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(campaignUpdateMock).not.toHaveBeenCalled();
  });

  it("re-checks forbidden words at send time — an unsafe approved row is NOT sent", async () => {
    // A row that passed approval but carries an unconditional claim (e.g. a
    // post-approval hand-edit / legacy row). Body contains "guaranteed".
    const unsafe = {
      id: "email_bad",
      toEmail: "bad@example.com",
      subject: "Our yield is guaranteed",
      body: "This is risk-free, returns are guaranteed.",
      prospectId: "prospect_bad",
    };
    emailFindManyMock.mockResolvedValue([unsafe, approvedRow(1)]);

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({
      step: buildStepShim(),
      event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } },
    });

    // Unsafe row blocked (never reaches Resend); the safe row still sends.
    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "r1@example.com" }),
    );
    // The blocked row is marked failed (uses the existing status, no new model).
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_bad" }, data: { status: "failed" } }),
    );
    // Fan-out continues: one sent, one blocked-as-failed, campaign flipped sent.
    expect(res).toEqual({ sent: 1, failed: 1, total: 2 });
    expect(campaignUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
    // The block is audited: action outreach.blockedSend, channel campaign_fanout,
    // reason forbidden_words, with the matched terms — and NEVER the email body.
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditArg = auditCreateMock.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("outreach.blockedSend");
    expect(auditArg.data.entityType).toBe("OutreachEmail");
    expect(auditArg.data.entityId).toBe("email_bad");
    const diff = JSON.parse(auditArg.data.diff) as {
      after: { reason: string; channel: string; campaignId: string; found: string[] };
    };
    expect(diff.after.reason).toBe("forbidden_words");
    expect(diff.after.channel).toBe("campaign_fanout");
    expect(diff.after.campaignId).toBe("camp_1");
    expect(Array.isArray(diff.after.found)).toBe(true);
    // Privacy: the full email body must never be persisted in the audit diff.
    expect(auditArg.data.diff).not.toContain("This is risk-free, returns are guaranteed.");
  });

  it("re-checks APY-range at send time — an approved row quoting a single-point APY is NOT sent", async () => {
    // A row that passed approval but quotes a fixed "target APY 11%" (e.g. a
    // post-approval hand-edit / legacy row). Non-negotiable #1: APY is ALWAYS a
    // range. The clean row still sends; the single-point one is blocked.
    const singlePointApy = {
      id: "email_apy",
      toEmail: "apy@example.com",
      subject: "Institutional yield — quick intro",
      body: "Our estimated target APY is 11% net over the term.",
      prospectId: "prospect_apy",
    };
    emailFindManyMock.mockResolvedValue([singlePointApy, approvedRow(1)]);

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({
      step: buildStepShim(),
      event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } },
    });

    // The single-point APY row is blocked (never reaches Resend); the safe row sends.
    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "r1@example.com" }),
    );
    // The blocked row is marked failed (uses the existing status, no new model).
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_apy" }, data: { status: "failed" } }),
    );
    // Fan-out continues: one sent, one blocked-as-failed, campaign flipped sent.
    expect(res).toEqual({ sent: 1, failed: 1, total: 2 });
    // The block is audited: reason single_point_apy, channel campaign_fanout,
    // and the email body is NEVER persisted in the audit diff.
    expect(auditCreateMock).toHaveBeenCalledTimes(1);
    const auditArg = auditCreateMock.mock.calls[0]![0];
    expect(auditArg.data.action).toBe("outreach.blockedSend");
    expect(auditArg.data.entityType).toBe("OutreachEmail");
    expect(auditArg.data.entityId).toBe("email_apy");
    const diff = JSON.parse(auditArg.data.diff) as {
      after: { reason: string; channel: string; campaignId: string };
    };
    expect(diff.after.reason).toBe("single_point_apy");
    expect(diff.after.channel).toBe("campaign_fanout");
    expect(diff.after.campaignId).toBe("camp_1");
    expect(auditArg.data.diff).not.toContain("Our estimated target APY is 11% net over the term.");
  });

  it("a forbidden word in the SUBJECT alone also blocks the send", async () => {
    const unsafeSubject = {
      id: "email_subj",
      toEmail: "subj@example.com",
      subject: "Risk-free institutional yield",
      body: "A perfectly clean body with no claims.",
      prospectId: "prospect_subj",
    };
    emailFindManyMock.mockResolvedValue([unsafeSubject]);

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({
      step: buildStepShim(),
      event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } },
    });

    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "email_subj" }, data: { status: "failed" } }),
    );
    expect(res).toEqual({ sent: 0, failed: 1, total: 1 });
  });

  it("suppression is still checked before the forbidden-words gate (no double send)", async () => {
    // A suppressed AND unsafe row: suppression wins first, still never sent,
    // marked failed once. Proves both gates coexist without a double dispatch.
    const both = {
      id: "email_both",
      toEmail: "both@example.com",
      subject: "guaranteed returns",
      body: "guaranteed",
      prospectId: "prospect_both",
    };
    emailFindManyMock.mockResolvedValue([both]);
    isSuppressedMock.mockResolvedValue(true);

    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    const res = await outreachSendHandler({
      step: buildStepShim(),
      event: { data: { campaignId: "camp_1", requestedBy: "0xadmin" } },
    });

    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
    expect(res).toEqual({ sent: 0, failed: 1, total: 1 });
  });

  it("rejects a malformed event payload before any send", async () => {
    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    await expect(
      // campaignId "" fails the Zod .min(1) guard → rejected before any send
      outreachSendHandler({ step: buildStepShim(), event: { data: { campaignId: "", requestedBy: "0xadmin" } } }),
    ).rejects.toThrow();
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });
});
