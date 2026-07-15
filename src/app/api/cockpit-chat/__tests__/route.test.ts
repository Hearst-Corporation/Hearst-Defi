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
    });

    const res = await POST(makeChatRequest("monte-moi un truc défensif"));
    expect(res.status).toBe(200);

    // Bubble shows ONLY the short fixed ack — the chat model never runs.
    const body = await readStreamText(res);
    expect(body).toContain("Product Workspace");
    // The ack is honest about the handoff: no auto-run, no auto-create, the
    // admin keeps control, and Projection is the next manual step.
    expect(body).toContain("Projection");
    expect(body).toContain("manual run required");
    expect(body).toContain("not guaranteed");
    expect(body.toLowerCase()).toContain("do not run a study");
    // Never claims the product/vault already exists or a run already fired.
    expect(body.toLowerCase()).not.toContain("product created");
    expect(body.toLowerCase()).not.toContain("vault created");
    expect(body.toLowerCase()).not.toContain("run launched");
    expect(body.toLowerCase()).not.toContain("investor-ready");
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

  it("product creation wins over the legacy vaults nav fallback for 'on va créer un produit'", async () => {
    // REGRESSION: "on va créer un produit" matches the legacy nav fallback as a
    // `vaults` navigation (the verb "va" + the noun "produit") AND the product
    // classifier as product creation. The product intent is more specific and
    // must win — the admin must land on the Product Workspace, never /vaults.
    mockClassify.mockReturnValue({
      kind: "product_creation",
      objective: "on va créer un produit qui s'appelle Titan Vault",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    });

    const res = await POST(
      makeChatRequest("on va créer un produit qui s'appelle Titan Vault"),
    );
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "on va créer un produit qui s'appelle Titan Vault",
        autostart: true,
        intentKind: "product_creation",
      });
    });
    // The legacy fallback must NOT have diverted to /vaults.
    expect(mockPublishNav).not.toHaveBeenCalledWith(USER_ID, {
      destinationKey: "vaults",
    });
  });

  it("opens the Product Workspace for a mixed product-creation + simulation intent (no dead Scenario Lab secondary)", async () => {
    // The Scenario Lab route was retired: a mixed product+simulation intent still
    // opens the Product Workspace, but the classifier no longer carries a
    // scenario-lab secondary, and the route publishes the primary directive only.
    mockClassify.mockReturnValue({
      kind: "mixed_product_creation_simulation",
      objective: "Créer un vault BTC Plus défensif",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    });

    // Use a message that the product-workspace classifier catches (mocked to return
    // shouldOpenProductWorkspace: true) but that the pre-LLM regex shortcut does
    // NOT catch (no nav verb).
    const res = await POST(makeChatRequest("créer un vault BTC Plus défensif avec validation"));
    expect(res.status).toBe(200);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Créer un vault BTC Plus défensif",
        autostart: true,
        intentKind: "mixed_product_creation_simulation",
      });
    });
    // No dead scenario-lab secondary is published.
    expect(mockPublishNav).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ secondaryDestinationKey: "admin-scenario-lab" }),
    );
  });

  it("retired [[canvas:create-vault]] marker routes to Product Workspace, not agent-canvas", async () => {
    mockClassify.mockReturnValue({
      kind: "product_framing",
      objective: "Help me frame a new vault and create it as a draft.",
      primaryDestinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
      autostart: true,
      shouldOpenProductWorkspace: true,
    });

    const res = await POST(
      makeChatRequest(
        "[[canvas:create-vault]] Help me frame a new vault and create it as a draft.",
      ),
    );
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
        destinationKey: PRODUCT_WORKSPACE_DESTINATION_KEY,
        objective: "Help me frame a new vault and create it as a draft.",
        autostart: true,
        intentKind: "product_framing",
      });
    });
    expect(mockPublishNav).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ destinationKey: "admin-agent-canvas" }),
    );
    expect(mockRunChatAgent).not.toHaveBeenCalled();
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

  it("does NOT navigate a standalone simulation intent — Scenario Lab route retired, falls to the LLM", async () => {
    classifyNotProduct();
    mockMasterAgentTurnWithoutNav();

    // The Scenario Lab route was removed, so "simuler …" no longer matches a
    // deterministic nav destination: it falls through to the normal chat turn.
    const res = await POST(makeChatRequest("simuler un stress test BTC bear"));
    expect(res.status).toBe(200);
    expect(mockRunChatAgent).toHaveBeenCalled();
    expect(mockPublishNav).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ destinationKey: "admin-scenario-lab" }),
    );
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
    // Router v2 fast-path now returns the SAME readable ack stream as the legacy
    // nav fallback (a human-facing bubble), NOT a raw JSON body. The navigation
    // itself travels out-of-band via publishNav (asserted below), so the user
    // never sees the bare {"navIntent":...} JSON in the chat.
    expect(body).not.toContain("navIntent");
    expect(body.trim().length).toBeGreaterThan(0);
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
    // Fast-path returns the readable ack stream, not raw JSON (see LP test).
    expect(body).not.toContain("navIntent");
    expect(body.trim().length).toBeGreaterThan(0);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    // The product-workspace classifier (a cheap, pure regex) is now consulted
    // before the nav fast-path so a product creation can win over a generic page
    // nav. For a non-product nav it returns shouldOpenProductWorkspace=false and
    // the fast-path proceeds — i.e. it never diverts this customers navigation.
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

  it("writes a deterministic NavTrace row when the regex nav shortcut fires", async () => {
    // "ouvre mon portefeuille" matches the deterministic regex nav shortcut
    // (resolveNavFallbackDestinationKey → portfolio). The shortcut publishes nav
    // before the LLM, so runChatAgent is NOT called. The NavTrace row carries
    // status:"published" + reason:"deterministic_router".
    const res = await POST(makeChatRequest("ouvre mon portefeuille"));
    expect(res.status).toBe(200);

    await vi.waitFor(() => {
      expect(mockNavTraceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          destinationKey: "portfolio",
          status: "published",
          reason: "deterministic_router",
        }),
      });
    });
    // The LLM never ran — the regex nav shortcut returned early.
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
    // Fast-path returns the readable ack stream, not raw JSON. Navigation is
    // proven by the publishNav call (out-of-band), not the response body.
    expect(body).not.toContain("navIntent");
    expect(body.trim().length).toBeGreaterThan(0);
    expect(mockRunChatAgent).not.toHaveBeenCalled();
    expect(mockPublishNav).toHaveBeenCalledWith(USER_ID, {
      destinationKey: "vaults",
    });
  });

  it("5. covered navigation never calls LLM router/classifier", async () => {
    // Phrases the deterministic router resolves WITHOUT any LLM call. NOTE:
    // "Ouvre mes positions" / "Show distributions" were intentionally removed
    // here — the 5 unwired portfolio sub-leaves (positions/activity/distributions/
    // yield/tax) were dropped from the nav whitelist (PR #149) so the chat no
    // longer routes investors to blank pages; they now fall through to the LLM by
    // design (covered by test 5b). "Show me projection" / "Ouvre scenario lab"
    // were likewise removed — the Scenario Lab + Projection routes were RETIRED,
    // so those phrases now fall through to the LLM too (no dead-route navigation).
    const coveredMessages = [
      "Amène-moi au dashboard",
      "Open my portfolio",
      "Va sur proof center",
      "Open outreach",
      "Montre les campagnes",
      "Va dans control tower",
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

  it("5b. de-whitelisted portfolio sub-leaves fall through to the LLM (PR #149)", async () => {
    // Regression guard for the whitelist pruning: these used to navigate to
    // blank unwired pages. They must NO LONGER resolve via the deterministic
    // router — they fall through to the normal chat turn instead.
    const removedLeaves = ["Ouvre mes positions", "Show distributions"];

    for (const message of removedLeaves) {
      vi.clearAllMocks();
      mockGetSession.mockResolvedValue({ role: "admin" } as never);
      mockMasterAgentTurnWithoutNav();
      const res = await POST(makeChatRequest(message));
      expect(res.status).toBe(200);
      expect(mockRunChatAgent).toHaveBeenCalled();
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