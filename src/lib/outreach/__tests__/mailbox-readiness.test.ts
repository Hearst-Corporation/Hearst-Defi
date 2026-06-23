/**
 * Tests for getMailboxReadiness — the read-only, PURE "what would a send do
 * right now" posture. No mailbox provider exists yet, so it must always report
 * `connected: false` and degrade honestly to draft-only / Resend fallback.
 *
 * env is mocked to drive OUTREACH_AUTONOMY; process.env drives the Resend flag.
 * No DB, no send, never leaks the Resend secret.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  OUTREACH_AUTONOMY: "SUGGEST" as string,
  OUTREACH_DAILY_SEND_CAP: 30,
}));

vi.mock("@/lib/env", () => ({ env: mockEnv }));

async function loadReadiness() {
  return (await import("@/lib/outreach/mailbox-readiness")).getMailboxReadiness();
}

const SAVED_RESEND = process.env.RESEND_API_KEY;

describe("getMailboxReadiness", () => {
  beforeEach(() => {
    mockEnv.OUTREACH_AUTONOMY = "SUGGEST";
    delete process.env.RESEND_API_KEY;
  });
  afterEach(() => {
    process.env.RESEND_API_KEY = SAVED_RESEND;
  });

  it("no mailbox ever connected today; SUGGEST → draft-only, not ready", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SUGGEST";
    process.env.RESEND_API_KEY = "re_fake_key";
    const m = await loadReadiness();

    expect(m.connected).toBe(false);
    expect(m.connection).toBeNull();
    expect(m.inboundSyncActive).toBe(false);
    expect(m.isReady).toBe(false); // SUGGEST blocks all sends regardless of transport
    expect(m.draftOnly).toBe(true);
    expect(m.sendProvider).toBe("resend"); // transport present, but gated by autonomy
    expect(m.statusLabel.toLowerCase()).toContain("draft-only");
  });

  it("SEND + Resend → ready via Resend fallback, still no personal mailbox", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    process.env.RESEND_API_KEY = "re_fake_key";
    const m = await loadReadiness();

    expect(m.isReady).toBe(true);
    expect(m.draftOnly).toBe(false);
    expect(m.sendProvider).toBe("resend");
    expect(m.connected).toBe(false);
    expect(m.statusLabel.toLowerCase()).toContain("resend");
  });

  it("no Resend key → no transport, draft-only even at SEND (fail-closed)", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    delete process.env.RESEND_API_KEY;
    const m = await loadReadiness();

    expect(m.sendProvider).toBe("none");
    expect(m.isReady).toBe(false);
    expect(m.draftOnly).toBe(true);
    expect(m.resendConfigured).toBe(false);
  });

  it("never leaks the Resend secret in the returned shape", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    process.env.RESEND_API_KEY = "re_super_secret_value";
    const m = await loadReadiness();

    expect(JSON.stringify(m)).not.toContain("re_super_secret_value");
    expect(m.resendConfigured).toBe(true); // boolean flag only
  });

  it("exposes a readiness checklist with the connection + transport gates", async () => {
    mockEnv.OUTREACH_AUTONOMY = "SEND";
    process.env.RESEND_API_KEY = "re_fake_key";
    const m = await loadReadiness();

    const labels = m.rules.map((r) => r.label);
    expect(labels).toContain("Connected mailbox");
    expect(labels).toContain("Delivery transport");
    expect(labels).toContain("Autonomy gate");
    // The connected-mailbox guard is not satisfied today.
    expect(m.rules.find((r) => r.label === "Connected mailbox")?.ok).toBe(false);
  });
});
