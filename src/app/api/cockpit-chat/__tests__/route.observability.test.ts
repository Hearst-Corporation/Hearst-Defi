/**
 * Route-level tests for Router Observability trace emission.
 *
 * Asserts the route records the correct OUTCOME per branch (nav fast-path,
 * dangerous refusal, negated no-nav, educational LLM, normal LLM), with NO
 * behaviour change, and that a trace-recording FAILURE never alters the response.
 *
 * The recorder is mocked so we observe the calls without touching Redis.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  getRedis: vi.fn(() => null),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));
vi.mock("@/lib/llm/openai", () => ({ openai: {}, LLM_MODEL: "gpt-4.1" }));
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
vi.mock("@/lib/llm/chat-agent", () => ({ runChatAgent: vi.fn() }));
vi.mock("@/lib/llm/nav-channel", () => ({ publishNav: vi.fn() }));

// THE recorder under observation. Default impl resolves (non-blocking).
vi.mock("@/lib/agentic/observability", () => ({
  recordRouterDecisionSafe: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runChatAgent, type ChatTurnFinal } from "@/lib/llm/chat-agent";
import { publishNav } from "@/lib/llm/nav-channel";
import { recordRouterDecisionSafe } from "@/lib/agentic/observability";

const mockRequireAuth = vi.mocked(requireAuth);
const mockGetSession = vi.mocked(getSession);
const mockAdminChatModeFindUnique = vi.mocked(prisma.adminChatMode.findUnique);
const mockCockpitChatCreate = vi.mocked(prisma.cockpitChat.create);
const mockCockpitMessageCreate = vi.mocked(prisma.cockpitMessage.create);
const mockCockpitMessageCount = vi.mocked(prisma.cockpitMessage.count);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockNavTraceCreate = vi.mocked(prisma.navTrace.create);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);
const mockRecord = vi.mocked(recordRouterDecisionSafe);

const USER_ID = "user-obs";

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

function mockTurn(finalOverride?: Partial<ChatTurnFinal>) {
  mockRunChatAgent.mockReturnValue({
    stream: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("ok"));
        c.close();
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

/** Outcomes recorded across all recorder calls this turn. */
function recordedOutcomes(): string[] {
  return mockRecord.mock.calls.map((c) => (c[0] as { outcome: string }).outcome);
}

describe("cockpit-chat — router observability trace emission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockGetSession.mockResolvedValue({ role: "investor" } as never);
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "normal",
      userId: USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({ id: "chat-1", userId: USER_ID } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    mockCockpitMessageCount.mockResolvedValue(1 as never);
    mockLlmRunCreate.mockResolvedValue({} as never);
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
    mockRecord.mockResolvedValue(undefined);
    mockTurn();
  });

  it("nav fast-path records outcome nav_fast_path, skips LLM", async () => {
    const res = await POST(makeChatRequest("montre les vaults"));
    await readStreamText(res);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(recordedOutcomes()).toContain("nav_fast_path");
  });

  it("dangerous refusal records dangerous_refusal, no LLM", async () => {
    const res = await POST(makeChatRequest("déploie ce produit"));
    await res.text();
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(recordedOutcomes()).toContain("dangerous_refusal");
  });

  it("negated nav records negated_no_nav and still reaches the LLM", async () => {
    await POST(makeChatRequest("ne montre pas les vaults"));
    expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
    expect(recordedOutcomes()).toContain("negated_no_nav");
  });

  it("educational turn records educational_llm and reaches the LLM", async () => {
    await POST(makeChatRequest("explique comment fonctionne le yield"));
    expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
    expect(recordedOutcomes()).toContain("educational_llm");
  });

  it("normal turn records normal_llm", async () => {
    await POST(makeChatRequest("bonjour, tu vas bien ?"));
    expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
    expect(recordedOutcomes()).toContain("normal_llm");
  });

  it("records exactly once per turn (no double recording)", async () => {
    await POST(makeChatRequest("explique comment fonctionne le yield"));
    expect(mockRecord).toHaveBeenCalledTimes(1);
  });

  it("a trace-recording rejection does NOT alter the response", async () => {
    // Even if the recorder throws/rejects, the route must respond normally.
    mockRecord.mockRejectedValue(new Error("trace sink down"));
    const res = await POST(makeChatRequest("montre les vaults"));
    expect(res.status).toBe(200);
    const body = await readStreamText(res);
    expect(body.length).toBeGreaterThan(0);
  });
});
