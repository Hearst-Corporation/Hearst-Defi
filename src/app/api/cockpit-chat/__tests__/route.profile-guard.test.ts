import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

/**
 * Profile-guard test for POST /api/cockpit-chat (P0 surface-leak fix).
 *
 * An LP (non-admin) who phrases a navigation toward an ADMIN-only surface must
 * NOT cause an admin nav directive to be published. The deterministic router's
 * augmented layer can resolve an admin route-key ("admin-outreach",
 * "admin-product-workspace") from the phrasing alone, but the route's fast-path
 * re-resolves the destination against the REAL user's allowance:
 *   - admin route-key + isAdmin=false  → dropped (no publishNav, no early
 *     navigate return) → falls through to a normal LLM answer.
 * So an LP asking for an admin page gets a normal answer and ZERO published nav.
 *
 * This file mocks the same seams as route.test.ts (LLM, auth, session, db,
 * publishNav) — it does NOT touch route.ts.
 */

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));

vi.mock("@/lib/llm/openai", () => ({
  openai: {},
  LLM_MODEL: "gpt-4.1",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminChatMode: { findUnique: vi.fn() },
    cockpitChat: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cockpitMessage: { create: vi.fn(), findMany: vi.fn(), count: vi.fn() },
    llmRun: { create: vi.fn() },
    navTrace: { create: vi.fn() },
  },
}));

vi.mock("@/lib/agents/user-context", () => ({
  loadUserAgentProfile: vi.fn().mockResolvedValue(null),
  loadUserMemory: vi.fn().mockResolvedValue(null),
  buildUserContextSystemBlock: vi.fn().mockReturnValue(null),
}));

vi.mock("@/lib/llm/chat-context", () => ({
  buildPortfolioContextBlock: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/llm/admin-context", () => ({
  buildAdminContextBlock: vi.fn().mockResolvedValue(""),
}));

vi.mock("@/lib/llm/chat-agent", () => ({
  runChatAgent: vi.fn(),
}));

vi.mock("@/lib/llm/nav-channel", () => ({
  publishNav: vi.fn(),
}));

// LLM canvas classifier OFF — keep the path deterministic.
vi.mock("@/lib/canvas/classify-canvas-intent", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/canvas/classify-canvas-intent")>();
  return {
    ...original,
    classifyCanvasIntentLlm: vi.fn().mockResolvedValue(null),
  };
});

// Default: not a product intent (the product-workspace short-circuit is
// admin-gated anyway, but keep the regex verdict explicit).
vi.mock("@/lib/llm/product-workspace-intent", async (importOriginal) => {
  const original =
    await importOriginal<typeof import("@/lib/llm/product-workspace-intent")>();
  return {
    ...original,
    classifyProductWorkspaceIntent: vi.fn().mockReturnValue({
      kind: "none",
      shouldOpenProductWorkspace: false,
      shouldOpenScenarioLab: false,
    }),
  };
});

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runChatAgent, type ChatTurnFinal } from "@/lib/llm/chat-agent";
import { publishNav } from "@/lib/llm/nav-channel";

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetSession = vi.mocked(getSession);
const mockAdminChatModeFindUnique = vi.mocked(prisma.adminChatMode.findUnique);
const mockCockpitChatCreate = vi.mocked(prisma.cockpitChat.create);
const mockCockpitMessageCreate = vi.mocked(prisma.cockpitMessage.create);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockNavTraceCreate = vi.mocked(prisma.navTrace.create);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);

const LP_USER_ID = "lp-profile-guard-test";

function makeChatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

async function readStreamText(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  return out + dec.decode();
}

/** A normal (non-nav, non-blocked) streamed answer from the chat engine. */
function mockNormalAnswer(finalOverride?: Partial<ChatTurnFinal>) {
  mockRunChatAgent.mockReturnValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    }),
    final: Promise.resolve({
      text: "ok",
      blocked: false,
      status: "success",
      errorType: null,
      usage: null,
      ...finalOverride,
    }),
  });
}

describe("POST /api/cockpit-chat — LP profile guard on admin-* navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The user is an LP (investor), NOT an admin.
    mockGetSession.mockResolvedValue({ role: "investor" } as never);
    mockRequireAuth.mockResolvedValue({ userId: LP_USER_ID });
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "normal",
      userId: LP_USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({
      id: "chat-1",
      userId: LP_USER_ID,
    } as never);
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({
      userId: LP_USER_ID,
    } as never);
    vi.mocked(prisma.cockpitChat.update).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitChat.updateMany).mockResolvedValue({
      count: 0,
    } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.cockpitMessage.count).mockResolvedValue(1 as never);
    mockLlmRunCreate.mockResolvedValue({} as never);
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("LP asking to open Outreach (admin surface) publishes NO nav and gets a normal answer", async () => {
    mockNormalAnswer();

    // "ouvre outreach" → router augmented layer resolves "admin-outreach" from
    // the phrasing, but the route drops it for a non-admin user.
    const res = await POST(makeChatRequest("ouvre outreach"));
    expect(res.status).toBe(200);

    // Falls through to a normal LLM answer (the admin nav was dropped).
    const body = await readStreamText(res);
    expect(body).toContain("ok");
    expect(mockRunChatAgent).toHaveBeenCalled();

    // ZERO nav published, no admin NavTrace row.
    expect(mockPublishNav).not.toHaveBeenCalled();
    expect(mockNavTraceCreate).not.toHaveBeenCalled();
  });

  it("LP asking to open the Product Workspace (admin surface) publishes NO nav", async () => {
    mockNormalAnswer();

    const res = await POST(
      makeChatRequest("ouvre le product workspace"),
    );
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    expect(body).toContain("ok");
    expect(mockRunChatAgent).toHaveBeenCalled();
    expect(mockPublishNav).not.toHaveBeenCalled();
  });

  it("control sanity: the SAME admin phrasing DOES publish nav for an admin user", async () => {
    // Flip the role to admin — the exact same message must now navigate, proving
    // the LP cases above are blocked by the profile guard, not by a dead router.
    mockGetSession.mockResolvedValue({ role: "admin" } as never);

    const res = await POST(makeChatRequest("ouvre outreach"));
    expect(res.status).toBe(200);

    // Admin → the router fast-path navigates before the LLM. The fast-path now
    // returns a readable ack stream (not raw JSON); navigation is proven by the
    // publishNav call.
    const body = await readStreamText(res);
    expect(body).not.toContain("navIntent");
    expect(body.trim().length).toBeGreaterThan(0);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(LP_USER_ID, {
      destinationKey: "admin-outreach",
    });
  });

  it("LP asking for a legit LP surface still navigates (guard is scoped, not blanket)", async () => {
    const res = await POST(makeChatRequest("ouvre mon portefeuille"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    expect(body).not.toContain("navIntent");
    expect(body.trim().length).toBeGreaterThan(0);
    expect(mockPublishNav).toHaveBeenCalledWith(LP_USER_ID, {
      destinationKey: "portfolio",
    });
  });
});
