import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

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
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
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
    cockpitMessage: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
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

// Product-intent classification is now an LLM call; mock it so tests choose the
// verdict deterministically (default: not a product intent → no short-circuit).
vi.mock("@/lib/llm/classify-product-intent", () => ({
  classifyProductIntentLlm: vi.fn(),
}));

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { runChatAgent, type ChatTurnFinal } from "@/lib/llm/chat-agent";
import { publishNav } from "@/lib/llm/nav-channel";
import { classifyProductIntentLlm } from "@/lib/llm/classify-product-intent";
import { PRODUCT_WORKSPACE_DESTINATION_KEY } from "@/lib/llm/product-workspace-intent";

const mockRequireAuth = vi.mocked(requireAuth);
const mockAdminChatModeFindUnique = vi.mocked(prisma.adminChatMode.findUnique);
const mockCockpitChatCreate = vi.mocked(prisma.cockpitChat.create);
const mockCockpitMessageCreate = vi.mocked(prisma.cockpitMessage.create);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockNavTraceCreate = vi.mocked(prisma.navTrace.create);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);
const mockClassify = vi.mocked(classifyProductIntentLlm);
const mockGetSession = vi.mocked(getSession);

/** Default: not a product intent (so most tests exercise the normal chat path). */
function classifyNotProduct() {
  mockClassify.mockResolvedValue({
    isProductIntent: false,
    kind: "none",
    wantsSimulation: false,
  });
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

const USER_ID = "admin-user-nav-test";

function makeChatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

function mockMasterAgentTurn(
  modelDestinationKey: string,
  finalOverride?: Partial<ChatTurnFinal>,
) {
  mockRunChatAgent.mockReturnValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    }),
    nav: Promise.resolve({
      key: modelDestinationKey,
      profile: "admin" as const,
      route: "/admin/scenario-lab",
      label: "Scenario Lab",
      description: "Simulation surface",
    }),
    final: Promise.resolve({
      text: "ok",
      blocked: false,
      status: "success",
      errorType: null,
      usage: null,
      navProposedKey: modelDestinationKey,
      navBlocked: false,
      ...finalOverride,
    }),
  });
}

function mockMasterAgentTurnWithoutNav(finalOverride?: Partial<ChatTurnFinal>) {
  mockRunChatAgent.mockReturnValue({
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("ok"));
        controller.close();
      },
    }),
    nav: Promise.resolve(null),
    final: Promise.resolve({
      text: "ok",
      blocked: false,
      status: "success",
      errorType: null,
      usage: null,
      navProposedKey: null,
      navBlocked: false,
      ...finalOverride,
    }),
  });
}

describe("POST /api/cockpit-chat — admin product-intent classification + nav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    // Product detection now gates on the admin ROLE, not the chat mode.
    mockGetSession.mockResolvedValue({ role: "admin" } as never);
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "admin",
      userId: USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({ id: "chat-1", userId: USER_ID } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    mockLlmRunCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("short-circuits when the LLM classifies a product intent: ack bubble, workspace nav, NO chat LLM call", async () => {
    mockClassify.mockResolvedValue({
      isProductIntent: true,
      kind: "product_creation",
      objective: "Monter un véhicule défensif",
      wantsSimulation: false,
    });

    const res = await POST(makeChatRequest("monte-moi un truc défensif"));
    expect(res.status).toBe(200);

    // Bubble shows ONLY the short fixed ack — the chat model never runs.
    const body = await readStreamText(res);
    expect(body).toContain("Product Workspace");
    expect(mockRunChatAgent).not.toHaveBeenCalled();

    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Monter un véhicule défensif",
        autostart: true,
        intentKind: "product_creation",
      });
    });
  });

  it("carries Scenario Lab as secondary metadata when the product intent also wants simulation", async () => {
    mockClassify.mockResolvedValue({
      isProductIntent: true,
      kind: "mixed_product_creation_simulation",
      objective: "Créer un vault BTC Plus et le stresser",
      wantsSimulation: true,
    });

    const res = await POST(makeChatRequest("fais un vault BTC plus et stress-teste-le"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Créer un vault BTC Plus et le stresser",
        autostart: true,
        intentKind: "mixed_product_creation_simulation",
        secondaryDestinationKey: "admin-scenario-lab",
        secondaryHint: "Scenario Lab validation requested",
      });
    });
  });

  it("does NOT short-circuit when the LLM says it is not a product intent — normal chat answer", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav({ text: "Le runbook a 5 étapes." });

    const res = await POST(makeChatRequest("explique le runbook de déploiement"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    expect(body).toContain("ok"); // the mocked stream chunk, streamed normally
    expect(mockRunChatAgent).toHaveBeenCalled();
    await vi.waitFor(() => expect(mockLlmRunCreate).toHaveBeenCalled());
  });

  it("publishes the model's own destination on a non-product navigation", async () => {
    classifyNotProduct();
    mockMasterAgentTurn("admin-dashboard");

    const res = await POST(makeChatRequest("montre le dashboard admin"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: "admin-dashboard",
      });
    });
  });

  it("falls back to Scenario Lab for a standalone simulation answered in plain text", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav();

    const res = await POST(makeChatRequest("simuler un stress test BTC bear"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: "admin-scenario-lab",
      });
    });
  });
});

describe("POST /api/cockpit-chat — LlmRun observability (OBS-01 / OBS-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "normal",
      userId: USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({ id: "chat-1", userId: USER_ID } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    mockLlmRunCreate.mockResolvedValue({} as never);
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("records a real success run with captured token usage and cost", async () => {
    mockMasterAgentTurn("portfolio", {
      navProposedKey: null,
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    });

    const res = await POST(makeChatRequest("Quel est mon portefeuille ?"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockLlmRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          agentName: "cockpit-chat",
          status: "success",
          errorType: null,
          inputTokens: 1000,
          outputTokens: 500,
          costUsd: expect.closeTo(0.006, 6),
        }),
      });
    });
  });

  it("records a failed run (no fake success) with null tokens when the turn errors", async () => {
    mockMasterAgentTurn("portfolio", {
      text: "",
      status: "failed",
      errorType: "llm_create",
      usage: null,
      navProposedKey: null,
    });

    const res = await POST(makeChatRequest("déclenche une erreur"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockLlmRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "failed",
          errorType: "llm_create",
          inputTokens: null,
          outputTokens: null,
          costUsd: null,
        }),
      });
    });
  });

  it("flags a compliance-blocked turn as success+compliance_blocked, not a fake plain success", async () => {
    mockMasterAgentTurn("portfolio", {
      text: "",
      blocked: true,
      status: "success",
      errorType: null,
      navProposedKey: null,
      usage: { prompt_tokens: 800, completion_tokens: 0, total_tokens: 800 },
    });

    const res = await POST(makeChatRequest("garantis-moi 12% de rendement"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockLlmRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: "success",
          errorType: "compliance_blocked",
        }),
      });
    });
  });
});

describe("POST /api/cockpit-chat — navigate tracing (OBS-02)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "normal",
      userId: USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({ id: "chat-1", userId: USER_ID } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    mockLlmRunCreate.mockResolvedValue({} as never);
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("traces a proposed+compliant navigation as published", async () => {
    mockMasterAgentTurn("portfolio", { navProposedKey: "portfolio", navBlocked: false });

    const res = await POST(makeChatRequest("montre mon portefeuille"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockNavTraceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: USER_ID,
          profile: "lp",
          mode: "normal",
          destinationKey: "portfolio",
          status: "published",
          reason: null,
        }),
      });
    });
  });

  it("traces a navigation dropped by the compliance guard as blocked", async () => {
    mockMasterAgentTurn("portfolio", {
      text: "",
      blocked: true,
      navProposedKey: "portfolio",
      navBlocked: true,
    });

    const res = await POST(makeChatRequest("emmène-moi quelque part"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockNavTraceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          destinationKey: "portfolio",
          status: "blocked",
          reason: "non_compliant_answer",
        }),
      });
    });
  });

  it("writes no nav trace when the model proposed no navigation", async () => {
    mockMasterAgentTurn("portfolio", { navProposedKey: null });

    const res = await POST(makeChatRequest("juste une question"));
    expect(res.status).toBe(200);

    // Let the off-path persistence settle, then assert no nav trace was written.
    await vi.waitFor(() => expect(mockLlmRunCreate).toHaveBeenCalled());
    expect(mockNavTraceCreate).not.toHaveBeenCalled();
  });
});
