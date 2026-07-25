/**
 * E2E route-level tests for the Master Agent write/send runtime.
 *
 * Unlike route.test.ts (which mocks executeAdminWriteTool), this drives the REAL
 * dispatch THROUGH the HTTP route: POST (mint) → confirmation_required → POST
 * (confirm) → real executeAdminWriteTool → real validateWriteToolInput + token
 * consume → tool run() → human message. The full path is exercised.
 *
 * Safety: external effects are mocked at the HIGHEST isolation point —
 * @/lib/outreach/admin-actions (runSourcing / draftEmailForProspect) and
 * @/lib/inngest/functions/outreach-auto-send (outreachAutoSendHandler). That cuts
 * off Resend / Apollo / HubSpot / prod-DB entirely. Confirmations + telemetry use
 * an in-memory @/lib/db mock. No real email, no real external call.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// External-effect isolation — the outreach write tools delegate here.
const h = vi.hoisted(() => {
  type ConfirmationRow = {
    token: string; userId: string; toolId: string; payloadHash: string;
    expiresAt: Date; usedAt: Date | null;
  };
  const tokenStore = new Map<string, ConfirmationRow>();
  return {
    tokenStore,
    mockRunSourcing: vi.fn(),
    mockDraftEmailForProspect: vi.fn(),
    mockOutreachAutoSendHandler: vi.fn(),
    adminToolRunCreate: vi.fn(async () => ({ id: "run_1" })),
    outreachIcpFindFirst: vi.fn(async () => ({ id: "icp_1" })),
  };
});
const {
  tokenStore,
  mockRunSourcing,
  mockDraftEmailForProspect,
  mockOutreachAutoSendHandler,
} = h;

vi.mock("@/lib/outreach/admin-actions", () => ({
  runSourcing: (...a: unknown[]) => h.mockRunSourcing(...a),
  draftEmailForProspect: (...a: unknown[]) => h.mockDraftEmailForProspect(...a),
}));
vi.mock("@/lib/inngest/functions/outreach-auto-send", () => ({
  outreachAutoSendHandler: (...a: unknown[]) => h.mockOutreachAutoSendHandler(...a),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminWriteToolConfirmation: {
      create: vi.fn(async (args: { data: Record<string, unknown> & { token: string } }) => {
        h.tokenStore.set(args.data.token, { ...args.data } as never);
        return args.data;
      }),
      findUnique: vi.fn(async (args: { where: { token: string } }) => {
        const r = h.tokenStore.get(args.where.token);
        return r ? { ...r } : null;
      }),
      updateMany: vi.fn(async (args: { where: { token?: string }; data: { usedAt: Date } }) => {
        const token = args.where.token;
        if (!token) return { count: 0 };
        const r = h.tokenStore.get(token);
        if (!r || r.usedAt !== null) return { count: 0 };
        r.usedAt = args.data.usedAt;
        h.tokenStore.set(token, r);
        return { count: 1 };
      }),
      deleteMany: vi.fn(async () => {
        const n = h.tokenStore.size;
        h.tokenStore.clear();
        return { count: n };
      }),
    },
    adminToolRun: { create: h.adminToolRunCreate },
    outreachICP: { findFirst: h.outreachIcpFindFirst },
  },
}));

import { POST } from "@/app/api/admin/chat-tools/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function req(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/chat-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

type WriteResponse = {
  status?: string;
  toolId?: string;
  confirmation?: { token?: string };
  result?: { title?: string; lines?: string[]; createdEntityId?: string };
  message?: { title?: string; body?: string };
  error?: string;
  code?: string;
};

/** Mint → returns confirmation token (asserts confirmation_required + human msg). */
async function mint(toolId: string, input: unknown): Promise<string> {
  const res = await POST(req({ action: "execute_write", toolId, input }));
  expect(res.status).toBe(200);
  const body = (await res.json()) as WriteResponse;
  expect(body.status).toBe("confirmation_required");
  expect(body.message?.body).toBeTruthy();
  return body.confirmation!.token!;
}

describe("E2E: Master Agent write/send runtime through the route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.clear();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
  });

  it("read direct: a safe read tool executes immediately, no confirmation, no raw secret", async () => {
    const res = await POST(req({ action: "execute_read", toolId: "read_runtime_capabilities" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status?: string; result?: { lines?: string[] }; confirmation?: unknown };
    expect(body.status).toBe("executed");
    expect(body.confirmation).toBeUndefined(); // reads never ask for confirmation
    expect(Array.isArray(body.result?.lines)).toBe(true);
    // no obvious secret leak in the surfaced lines
    expect((body.result?.lines ?? []).join("\n")).not.toMatch(/sk-|re_[A-Za-z0-9]{8,}|API_KEY/);
  });

  it("read failure: a read tool that errors returns a clean 500 — no invented data, no stack", async () => {
    // read_market_snapshot hits prisma.miningMetric.findFirst, which is absent
    // from the db mock → the tool throws → the route maps to a generic 500.
    const res = await POST(req({ action: "execute_read", toolId: "read_market_snapshot" }));
    expect(res.status).toBe(500);
    const body = (await res.json()) as { error?: string };
    expect(body.error).toBe("Read tool execution failed");
    expect(body.error).not.toMatch(/prisma|undefined|TypeError|stack/i);
  });

  it("draft email: mint → confirm → executed, draft-only (no send handler hit)", async () => {
    mockDraftEmailForProspect.mockResolvedValue({
      emailId: "email_1", toEmail: "lead@example.com", subject: "Intro",
    });
    const token = await mint("outreach_draft_email", { prospectId: "p1" });
    // before-confirm message says nothing is sent
    // confirm
    const res = await POST(req({ action: "execute_write", toolId: "outreach_draft_email", input: { prospectId: "p1" }, confirmedToken: token }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteResponse;
    expect(body.status).toBe("executed");
    expect(mockDraftEmailForProspect).toHaveBeenCalledWith("p1");
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled(); // never sends
    expect(body.result?.lines?.join("\n")).toMatch(/NOT sent/i);
  });

  it("source leads: invalid count → 400 human message, NO token minted, NO sourcing", async () => {
    const res = await POST(req({ action: "execute_write", toolId: "outreach_source_leads", input: { count: -5 } }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as WriteResponse;
    expect(body.message?.body).toMatch(/number of leads/i);
    expect(body.message?.body).not.toMatch(/zod|too_small/i);
    expect(tokenStore.size).toBe(0);
    expect(mockRunSourcing).not.toHaveBeenCalled();
  });

  it("source leads: valid → mint → confirm → sourcing runs once", async () => {
    mockRunSourcing.mockResolvedValue({
      sourced: 3, skipped: 0, isMock: true, byTier: { A: 1, B: 1, C: 1 }, enrichFailed: 0, dedupSkipped: 0,
    });
    const token = await mint("outreach_source_leads", { count: 3 });
    const res = await POST(req({ action: "execute_write", toolId: "outreach_source_leads", input: { count: 3 }, confirmedToken: token }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteResponse;
    expect(body.status).toBe("executed");
    expect(mockRunSourcing).toHaveBeenCalledTimes(1);
    expect(body.result?.lines?.join("\n")).toMatch(/Nothing sent/i);
  });

  it("trigger send run in SUGGEST: mint → confirm → zero send, 'nothing auto-sends'", async () => {
    mockOutreachAutoSendHandler.mockResolvedValue({
      autonomy: "SUGGEST", budget: 0, sent: 0, suppressed: 0, failed: 0, skippedIneligible: 0,
    });
    const token = await mint("outreach_trigger_send_run", {});
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled(); // not before confirm
    const res = await POST(req({ action: "execute_write", toolId: "outreach_trigger_send_run", input: {}, confirmedToken: token }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteResponse;
    expect(body.status).toBe("executed");
    expect(mockOutreachAutoSendHandler).toHaveBeenCalledTimes(1);
    const text = body.result?.lines?.join("\n") ?? "";
    expect(text).toMatch(/autonomy: SUGGEST/);
    expect(text).toMatch(/sent: 0/);
    expect(text).toMatch(/nothing auto-sends/i);
  });

  it("token replay: second confirm with the same token is refused with a human message", async () => {
    mockOutreachAutoSendHandler.mockResolvedValue({
      autonomy: "SUGGEST", budget: 0, sent: 0, suppressed: 0, failed: 0, skippedIneligible: 0,
    });
    const token = await mint("outreach_trigger_send_run", {});
    // first confirm OK
    const first = await POST(req({ action: "execute_write", toolId: "outreach_trigger_send_run", input: {}, confirmedToken: token }));
    expect((await first.json() as WriteResponse).status).toBe("executed");
    // replay
    const second = await POST(req({ action: "execute_write", toolId: "outreach_trigger_send_run", input: {}, confirmedToken: token }));
    expect([409, 410]).toContain(second.status);
    const body = (await second.json()) as WriteResponse;
    expect(body.code).toBe("used");
    expect(body.error).not.toMatch(/admin_write_confirmation/);
    expect(body.message?.body).toMatch(/already used/i);
    // handler ran exactly once across both attempts
    expect(mockOutreachAutoSendHandler).toHaveBeenCalledTimes(1);
  });

  it("payload tampering: confirm with a different input is refused (mismatch), handler not run", async () => {
    mockRunSourcing.mockResolvedValue({
      sourced: 1, skipped: 0, isMock: true, byTier: { A: 0, B: 1, C: 0 }, enrichFailed: 0, dedupSkipped: 0,
    });
    const token = await mint("outreach_source_leads", { count: 3 });
    // confirm with a DIFFERENT input than was minted
    const res = await POST(req({ action: "execute_write", toolId: "outreach_source_leads", input: { count: 9 }, confirmedToken: token }));
    expect([409, 410]).toContain(res.status);
    const body = (await res.json()) as WriteResponse;
    expect(body.code).toBe("mismatch");
    expect(body.message?.body).toMatch(/changed|start it again/i);
    expect(mockRunSourcing).not.toHaveBeenCalled();
  });
});
