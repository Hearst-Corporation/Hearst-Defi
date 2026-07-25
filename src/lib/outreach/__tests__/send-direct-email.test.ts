/**
 * Unit tests for sendDirectEmail (src/lib/outreach/admin-actions.ts) — the
 * one-off synchronous admin send. Single human action → real Resend dispatch,
 * so the guards (admin, valid recipient, forbidden words, suppression) are the
 * only thing between a click and a real email. This pins them.
 *
 * Resend is mocked at the @/lib/email/send boundary — no real fetch, no real
 * email. Asserts:
 *   - invalid recipient → { ok: false }, never calls Resend
 *   - forbidden wording (incl. the newly-closed "assured" gap) → blocked, no send
 *   - suppressed recipient → blocked, no send
 *   - happy path → one send, returns the resend id
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendTrackedEmailMock = vi.fn(async () => ({ id: "resend_direct_id" }));
const isSuppressedMock = vi.fn(async () => false);

const campaignFindFirstMock = vi.fn(async () => ({ id: "direct_camp" }));
const campaignCreateMock = vi.fn(async () => ({ id: "direct_camp" }));
const emailCreateMock = vi.fn(async () => ({ id: "email_direct" }));
const emailUpdateMock = vi.fn(async () => ({}));
const auditCreateMock = vi.fn(async () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin_1", walletAddress: "0xadmin" })),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

vi.mock("@/lib/email/send", () => ({
  sendTrackedEmail: sendTrackedEmailMock,
  renderPlainHtml: (body: string) => `<html>${body}</html>`,
}));

vi.mock("@/lib/outreach/suppression", () => ({ isSuppressed: isSuppressedMock }));

vi.mock("@/lib/outreach/cta-url", () => ({ resolveCtaUrl: () => "https://app.test/apply" }));

vi.mock("@/lib/hubspot/sync-prospect", () => ({
  upsertProspectContact: vi.fn(async () => undefined),
  logEmailActivity: vi.fn(async () => undefined),
}));

// The agent writer is unused by sendDirectEmail but the module imports it.
vi.mock("@/lib/agents/outreach-writer", () => ({
  draftColdEmail: vi.fn(async () => ({ subject: "s", body: "b" })),
  draftNewsletter: vi.fn(async () => ({ subject: "s", body: "b" })),
}));

vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

vi.mock("@/lib/outreach/icp", () => ({
  serializeList: () => "",
  parseIcpFilters: () => ({}),
  runSourcingForIcp: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachCampaign: { findFirst: campaignFindFirstMock, create: campaignCreateMock },
    outreachEmail: { create: emailCreateMock, update: emailUpdateMock },
    adminAudit: { create: auditCreateMock },
  },
}));

/** Build a FormData for sendDirectEmail. */
function fd(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.set(k, v);
  return form;
}

describe("sendDirectEmail — one-off admin send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isSuppressedMock.mockResolvedValue(false);
    sendTrackedEmailMock.mockResolvedValue({ id: "resend_direct_id" });
  });

  it("rejects an invalid recipient before any send", async () => {
    const { sendDirectEmail } = await import("@/lib/outreach/admin-actions");
    const res = await sendDirectEmail(fd({ to: "not-an-email", subject: "Hi", body: "Hello there." }));

    expect(res.ok).toBe(false);
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });

  it("blocks forbidden wording — including the newly-closed 'assured' gap", async () => {
    const { sendDirectEmail } = await import("@/lib/outreach/admin-actions");
    const res = await sendDirectEmail(
      fd({ to: "lead@example.com", subject: "An assured return", body: "We offer an assured return." }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/forbidden/i);
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });

  it("blocks a suppressed / opted-out recipient", async () => {
    isSuppressedMock.mockResolvedValue(true);
    const { sendDirectEmail } = await import("@/lib/outreach/admin-actions");
    const res = await sendDirectEmail(
      fd({ to: "opted@example.com", subject: "Hello", body: "A compliant note." }),
    );

    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsubscribed|suppression/i);
    expect(sendTrackedEmailMock).not.toHaveBeenCalled();
  });

  it("happy path — sends once and returns the resend id", async () => {
    const { sendDirectEmail } = await import("@/lib/outreach/admin-actions");
    const res = await sendDirectEmail(
      fd({ to: "Lead@Example.com", subject: "Quick intro", body: "A compliant institutional note." }),
    );

    expect(res.ok).toBe(true);
    expect(res.resendEmailId).toBe("resend_direct_id");
    expect(sendTrackedEmailMock).toHaveBeenCalledTimes(1);
    expect(sendTrackedEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "lead@example.com" }), // lowercased
    );
    // row stamped sent after Resend confirms
    expect(emailUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "sent" }) }),
    );
  });
});
