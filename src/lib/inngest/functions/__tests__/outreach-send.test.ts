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

  it("rejects a malformed event payload before any send", async () => {
    const { outreachSendHandler } = await import("@/lib/inngest/functions/outreach-send");
    await expect(
      // campaignId "" fails the Zod .min(1) guard → rejected before any send
      outreachSendHandler({ step: buildStepShim(), event: { data: { campaignId: "", requestedBy: "0xadmin" } } }),
    ).rejects.toThrow();
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });
});
