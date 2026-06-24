/**
 * E2E route-level — create_campaign_draft HITL flow (NO prod write).
 *
 * Drives the REAL /api/admin/chat-tools dispatch: POST (mint) →
 * confirmation_required → POST (confirm) → real executeAdminWriteTool → token
 * consume → runCreateCampaignDraft → createCampaign(FormData). The campaign
 * action is mocked at the highest isolation point, so NOTHING is written to
 * Supabase. Proves:
 *   - propose mints a token and creates NO campaign;
 *   - confirm creates EXACTLY one draft (createCampaign called once, name + kind);
 *   - the redirect() the form action throws is swallowed (no fake 500 — WIRE-2);
 *   - sourcing / drafting / sending are NEVER invoked.
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

const h = vi.hoisted(() => {
  type ConfirmationRow = {
    token: string; userId: string; toolId: string; payloadHash: string;
    expiresAt: Date; usedAt: Date | null;
  };
  const tokenStore = new Map<string, ConfirmationRow>();
  return {
    tokenStore,
    mockCreateCampaign: vi.fn(),
    mockRunSourcing: vi.fn(),
    mockDraftEmailForProspect: vi.fn(),
    mockOutreachAutoSendHandler: vi.fn(),
  };
});
const { tokenStore, mockCreateCampaign, mockRunSourcing, mockDraftEmailForProspect, mockOutreachAutoSendHandler } = h;

vi.mock("@/app/admin/outreach/actions", () => ({
  createCampaign: (...a: unknown[]) => h.mockCreateCampaign(...a),
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
    adminToolRun: { create: vi.fn(async () => ({ id: "run_1" })) },
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
  confirmation?: { token?: string };
  result?: { title?: string; lines?: string[]; createdEntityId?: string };
  message?: { body?: string };
};

const INPUT = { name: "Distributeurs Institutionnels Q3", kind: "cold", includeTypeform: true };

describe("create_campaign_draft — HITL mint → confirm (no prod write)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenStore.clear();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
  });

  it("propose: mints a token and creates NO campaign yet", async () => {
    const res = await POST(req({ action: "execute_write", toolId: "create_campaign_draft", input: INPUT }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteResponse;
    expect(body.status).toBe("confirmation_required");
    expect(body.confirmation?.token).toBeTruthy();
    // Nothing created on the propose press.
    expect(mockCreateCampaign).not.toHaveBeenCalled();
    expect(tokenStore.size).toBe(1);
  });

  it("confirm: creates EXACTLY one draft with the exact name + kind; no source/draft/send", async () => {
    // createCampaign is the admin FORM action — it persists then redirect()s.
    // Mock it resolving (the WIRE-2 redirect-swallow is covered by the next test).
    mockCreateCampaign.mockResolvedValue(undefined);

    const mintRes = await POST(req({ action: "execute_write", toolId: "create_campaign_draft", input: INPUT }));
    const token = ((await mintRes.json()) as WriteResponse).confirmation!.token!;

    const res = await POST(
      req({ action: "execute_write", toolId: "create_campaign_draft", input: INPUT, confirmedToken: token }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as WriteResponse;
    expect(body.status).toBe("executed");

    // Exactly ONE draft creation, via the single createCampaign path.
    expect(mockCreateCampaign).toHaveBeenCalledTimes(1);
    const form = mockCreateCampaign.mock.calls[0]![0] as FormData;
    expect(form.get("name")).toBe("Distributeurs Institutionnels Q3");
    expect(form.get("kind")).toBe("cold");

    // Result is draft-only; nothing sourced/drafted/sent.
    expect(body.result?.lines?.join("\n")).toMatch(/status: draft/i);
    expect(body.result?.lines?.join("\n")).toMatch(/no leads sourced/i);
    expect(mockRunSourcing).not.toHaveBeenCalled();
    expect(mockDraftEmailForProspect).not.toHaveBeenCalled();
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled();
  });

  it("confirm: swallows the redirect() the form action throws — executed, not a fake 500 (WIRE-2)", async () => {
    // Simulate the Next redirect control-flow signal createCampaign throws.
    const redirectErr = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/admin/outreach/abc;307;",
    });
    mockCreateCampaign.mockRejectedValue(redirectErr);

    const mintRes = await POST(req({ action: "execute_write", toolId: "create_campaign_draft", input: INPUT }));
    const token = ((await mintRes.json()) as WriteResponse).confirmation!.token!;

    const res = await POST(
      req({ action: "execute_write", toolId: "create_campaign_draft", input: INPUT, confirmedToken: token }),
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as WriteResponse).status).toBe("executed");
    expect(mockCreateCampaign).toHaveBeenCalledTimes(1);
  });

  it("propose: invalid input (empty name) → 400, NO token, NO campaign", async () => {
    const res = await POST(
      req({ action: "execute_write", toolId: "create_campaign_draft", input: { name: "", kind: "cold" } }),
    );
    expect(res.status).toBe(400);
    expect(tokenStore.size).toBe(0);
    expect(mockCreateCampaign).not.toHaveBeenCalled();
  });
});
