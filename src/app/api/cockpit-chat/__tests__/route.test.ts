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

vi.mock("@/lib/canvas/classify-canvas-intent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/canvas/classify-canvas-intent")>();
  return {
    ...original,
    classifyCanvasIntentLlm: vi.fn().mockResolvedValue(null),
  };
});

// Product-intent classification is now a deterministic regex; mock it so tests
// choose the verdict explicitly (default: not a product intent → no short-circuit).
vi.mock("@/lib/llm/product-workspace-intent", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/llm/product-workspace-intent")>();
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
import {
  classifyProductWorkspaceIntent,
  PRODUCT_WORKSPACE_DESTINATION_KEY,
} from "@/lib/llm/product-workspace-intent";
import { classifyCanvasIntentLlm } from "@/lib/canvas/classify-canvas-intent";

const mockRequireAuth = vi.mocked(requireAuth);
const mockAdminChatModeFindUnique = vi.mocked(prisma.adminChatMode.findUnique);
const mockCockpitChatCreate = vi.mocked(prisma.cockpitChat.create);
const mockCockpitMessageCreate = vi.mocked(prisma.cockpitMessage.create);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockNavTraceCreate = vi.mocked(prisma.navTrace.create);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);
const mockClassify = vi.mocked(classifyProductWorkspaceIntent);
const mockClassifyCanvasIntentLlm = vi.mocked(classifyCanvasIntentLlm);
const mockGetSession = vi.mocked(getSession);

/** Default: not a product intent (so most tests exercise the normal chat path). */
function classifyNotProduct() {
  mockClassify.mockReturnValue({
    kind: "none",
    shouldOpenProductWorkspace: false,
    shouldOpenScenarioLab: false,
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
  _destinationKey: string,
  finalOverride?: Partial<ChatTurnFinal>,
) {
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

function mockMasterAgentTurnWithoutNav(finalOverride?: Partial<ChatTurnFinal>) {
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
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("short-circuits when the deterministic classifier detects a product intent: ack bubble, workspace nav, NO chat LLM call", async () => {
    mockClassify.mockReturnValue({
      kind: "product_creation",
      objective: "Monter un véhicule défensif",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: false,
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
    mockClassify.mockReturnValue({
      kind: "mixed_product_creation_simulation",
      objective: "Créer un vault BTC Plus défensif",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      secondaryDestinationKey: "admin-scenario-lab",
      secondaryHint: "Scenario Lab validation requested",
      autostart: true,
      shouldOpenProductWorkspace: true,
      shouldOpenScenarioLab: true,
    });

    // Use a message that the product-workspace classifier catches (mocked to return
    // shouldOpenProductWorkspace: true) but that the pre-LLM regex shortcut does
    // NOT catch (no nav verb + no standalone "simuler" keyword that would route to
    // scenario-lab first).
    const res = await POST(makeChatRequest("créer un vault BTC Plus défensif avec validation"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Créer un vault BTC Plus défensif",
        autostart: true,
        intentKind: "mixed_product_creation_simulation",
        secondaryDestinationKey: "admin-scenario-lab",
        secondaryHint: "Scenario Lab validation requested",
      });
    });
  });

  it("does NOT short-circuit when the regex says it is not a product intent — normal chat answer", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav({ text: "Le runbook a 5 étapes." });

    const res = await POST(makeChatRequest("explique le runbook de déploiement"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    expect(body).toContain("ok"); // the mocked stream chunk, streamed normally
    expect(mockRunChatAgent).toHaveBeenCalled();
    await vi.waitFor(() => expect(mockLlmRunCreate).toHaveBeenCalled());
  });

  it("falls back to Scenario Lab for a standalone simulation intent in plain text (regex nav)", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav();

    // "simuler" is handled by the pre-LLM regex shortcut (resolveNavFallbackDestinationKey)
    // — it routes directly before the LLM runs.
    const res = await POST(makeChatRequest("simuler un stress test BTC bear"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: "admin-scenario-lab",
      });
    });
  });

  it("falls back to Customers when admin asks to create a client in plain text (regex nav)", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav();

    const res = await POST(makeChatRequest("créer un nouveau client"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: "admin-customers",
      });
    });
  });

  it("falls back to Outreach for an email prospection intent in plain text (regex nav)", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav();

    const res = await POST(makeChatRequest("prépare un email de prospection"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: "admin-outreach",
      });
    });
  });
});

describe("POST /api/cockpit-chat — LP nav fallback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    mockGetSession.mockResolvedValue({ role: "investor" } as never);
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

  it("router v2 short-circuits navigation before LLM when LP asks to open portfolio", async () => {
    const res = await POST(makeChatRequest("ouvre mon portefeuille"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    // Router v2 returns JSON with navIntent, not the legacy ack text
    const parsed = JSON.parse(body);
    expect(parsed.navIntent).toBe("portfolio");
    expect(parsed.metadata.intent).toBe("navigate");
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
      destinationKey: "portfolio",
    });
  });
});

describe("POST /api/cockpit-chat — admin nav regex shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    mockGetSession.mockResolvedValue({ role: "admin" } as never);
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    mockAdminChatModeFindUnique.mockResolvedValue({
      mode: "normal",
      userId: USER_ID,
      updatedAt: new Date(),
    });
    mockCockpitChatCreate.mockResolvedValue({ id: "chat-1", userId: USER_ID } as never);
    mockCockpitMessageCreate.mockResolvedValue({} as never);
    mockNavTraceCreate.mockResolvedValue({} as never);
    mockPublishNav.mockResolvedValue(undefined);
  });

  it("router v2 short-circuits admin navigation before LLM", async () => {
    const res = await POST(makeChatRequest("ouvre le portefeuille utilisateur"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    const parsed = JSON.parse(body);
    expect(parsed.navIntent).toBe("admin-customers");
    expect(parsed.metadata.intent).toBe("navigate");
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockClassify).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
      destinationKey: "admin-customers",
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
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({
      userId: USER_ID,
    } as never);
    mockMasterAgentTurn("portfolio", {
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    });

    const res = await POST(makeChatRequest("quelle est la structure du vault HYV ?"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockLlmRunCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: expect.stringMatching(/^llm:turn_/),
          agentName: "cockpit-chat",
          status: "success",
          errorType: null,
          inputTokens: 1000,
          outputTokens: 500,
          // gpt-4o-mini pricing: 1000×0.15/1M + 500×0.60/1M = 0.00045
          costUsd: expect.closeTo(0.00045, 6),
        }),
      });
    });

    const llmTurnId = String(mockLlmRunCreate.mock.calls[0]?.[0]?.data.id).replace(
      /^llm:/,
      "",
    );
    const messageIds = mockCockpitMessageCreate.mock.calls.map((call) =>
      String(call[0].data.id),
    );
    expect(messageIds).toContain(`msg:${llmTurnId}:user:main`);
    expect(messageIds).toContain(`msg:${llmTurnId}:assistant:reply`);
  });

  it("records a failed run (no fake success) with null tokens when the turn errors", async () => {
    mockMasterAgentTurn("portfolio", {
      text: "",
      status: "failed",
      errorType: "llm_create",
      usage: null,
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

  // Navigation is deterministic (regex shortcut). NavTrace rows are written by
  // the shortcut block, not the LLM path — a normal chat turn (no nav intent)
  // never touches navTrace.create, and a nav-shortcut turn writes exactly one
  // deterministic row with status:"published" / reason:"deterministic_router".

  it("writes no nav trace on a plain LLM answer (no nav intent, shortcut not triggered)", async () => {
    mockMasterAgentTurnWithoutNav();

    const res = await POST(makeChatRequest("quelle est la structure Cayman ?"));
    expect(res.status).toBe(200);

    // Let the off-path persistence settle, then assert no nav trace was written.
    await vi.waitFor(() => expect(mockLlmRunCreate).toHaveBeenCalled());
    expect(mockNavTraceCreate).not.toHaveBeenCalled();
  });

  it("writes no nav trace on a compliance-blocked LLM answer (shortcut not triggered)", async () => {
    mockMasterAgentTurnWithoutNav({
      text: "",
      blocked: true,
      status: "success",
      errorType: null,
    });

    const res = await POST(makeChatRequest("explique-moi la structure Cayman du vault"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => expect(mockLlmRunCreate).toHaveBeenCalled());
    expect(mockNavTraceCreate).not.toHaveBeenCalled();
  });

  it("writes a deterministic NavTrace row when the router v2 navigation fires", async () => {
    // "ouvre mon portefeuille" matches the router v2 navigation rule (portfolio).
    // The router fires before the LLM, so runChatAgent is NOT called.
    // The NavTrace row must carry status:"published" + reason:"deterministic_router_v2".
    const res = await POST(makeChatRequest("ouvre mon portefeuille"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockNavTraceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          destinationKey: "portfolio",
          status: "published",
          reason: "deterministic_router_v2",
        }),
      });
    });
    // The LLM never ran — the router returned early.
    expect(mockRunChatAgent).not.toHaveBeenCalled();
  });

describe("POST /api/cockpit-chat — router v2 safe paths", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    classifyNotProduct();
    mockGetSession.mockResolvedValue({ role: "investor" } as never);
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

  it("1. navigation positive: router v2 drives nav before LLM for 'va dans les vaults'", async () => {
    const res = await POST(makeChatRequest("va dans les vaults"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    const parsed = JSON.parse(body);
    expect(parsed.navIntent).toBe("vaults");
    expect(parsed.metadata.intent).toBe("navigate");
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
      destinationKey: "vaults",
    });
  });

  it("2. negation: 'ne va pas dans les vaults' → no nav, falls through to LLM", async () => {
    mockMasterAgentTurnWithoutNav();

    const res = await POST(makeChatRequest("ne va pas dans les vaults"));
    expect(res.status).toBe(200);

    // The router detects negation and flips to cancellation — no nav, no refusal.
    // The message falls through to the LLM path.
    expect(mockRunChatAgent).toHaveBeenCalled();
    expect(mockPublishNav).not.toHaveBeenCalled();
  });

  it("3. dangerous intent refusal: 'déploie ce produit' → refusal without LLM", async () => {
    const res = await POST(makeChatRequest("déploie ce produit"));
    expect(res.status).toBe(200);

    const body = await readStreamText(res);
    const parsed = JSON.parse(body);
    expect(parsed.role).toBe("assistant");
    expect(parsed.content).toContain("Je ne peux pas");
    expect(parsed.metadata.intent).toBe("refusal");
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockPublishNav).not.toHaveBeenCalled();
  });

  it("5. covered navigation never calls LLM router/classifier", async () => {
    const coveredMessages = [
      "Amène-moi au dashboard",
      "Open my portfolio",
      "Va sur proof center",
      "Show me projection",
      "Ouvre scenario lab",
      "Open outreach",
      "Montre les campagnes",
      "Va dans control tower",
      "Ouvre mes positions",
      "Show distributions",
    ];

    for (const message of coveredMessages) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue({ role: "admin" } as never);
      const res = await POST(makeChatRequest(message));
      expect(res.status).toBe(200);
      expect(mockRunChatAgent).not.toHaveBeenCalled();
      expect(mockClassifyCanvasIntentLlm).not.toHaveBeenCalled();
    }
  });

  it("4. fallback legacy: router misses → LLM runs normally", async () => {
    mockMasterAgentTurnWithoutNav();

    // A message that does NOT match any router rule with high confidence
    const res = await POST(makeChatRequest("raconte-moi une blague"));
    expect(res.status).toBe(200);

    // Falls through to LLM — runChatAgent is called
    expect(mockRunChatAgent).toHaveBeenCalled();
    // No nav published (no nav intent detected)
    expect(mockPublishNav).not.toHaveBeenCalled();
  });
});
});