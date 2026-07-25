/**
 * Route-level tests for the SURVIVING deterministic navigation behaviour of the
 * cockpit-chat route.
 *
 * The route was decoupled from the agentic router: the negation guard, the
 * educational read-only steering directive, and the pre-LLM dangerous-refusal
 * short-circuit no longer live in this route (those assertions were removed
 * with the router lot). What REMAINS and is still asserted here:
 *
 *  1. POSITIVE NAV SHORTCUT — "montre les vaults" publishes nav deterministically
 *     (regex router) and short-circuits the LLM. No regression.
 *
 *  2. PRODUCT WORKSPACE DIVERT (admin) — vault/product-creation phrasings navigate
 *     (admin) to the canonical Product Workspace deterministically: real
 *     classifier, no LLM, no "section not found". A non-product message from the
 *     same admin must NOT divert.
 *
 * These exercise the REAL router (no mock) through the POST handler.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-auth", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getSession: vi.fn() }));
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
const mockCockpitMessageCount = vi.mocked(prisma.cockpitMessage.count);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockNavTraceCreate = vi.mocked(prisma.navTrace.create);
const mockRunChatAgent = vi.mocked(runChatAgent);
const mockPublishNav = vi.mocked(publishNav);

const USER_ID = "user-router-stab";

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

describe("cockpit-chat — surviving deterministic nav shortcut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    // Default: plain LP (no admin role → no product-workspace divert path).
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
    mockTurn();
  });

  it('positive "montre les vaults" publishes nav and short-circuits the LLM', async () => {
    const res = await POST(makeChatRequest("montre les vaults"));
    await readStreamText(res);
    await vi.waitFor(() => {
      expect(mockPublishNav).toHaveBeenCalledWith(
        USER_ID,
        expect.objectContaining({ destinationKey: "vaults" }),
      );
    });
    // Nav shortcut path: no LLM call.
    expect(mockRunChatAgent).not.toHaveBeenCalled();
  });
});

// ── assistant navigation intent (vault / product workspace) ───────────────────
// The exact failing logs must now navigate (admin) to the canonical Product
// Workspace, deterministically: real classifier, no LLM, no "section not found".
describe("cockpit-chat — vault/product creation routes to Product Workspace (admin)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    // ADMIN role → the product-workspace divert path is active.
    mockGetSession.mockResolvedValue({ role: "admin" } as never);
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
    mockTurn();
  });

  for (const msg of [
    "Va faire un volt",
    "go vault creation",
    "On va faire un vault",
    "Va créer un produit.",
    "Va créer dans le workspace.",
    "ouvre le workspace produit",
    "construction produit",
  ]) {
    it(`"${msg}" → publishNav(admin-vaults-new), no LLM, no reject ack`, async () => {
      const res = await POST(makeChatRequest(msg));
      const body = await readStreamText(res);
      await vi.waitFor(() => {
        expect(mockPublishNav).toHaveBeenCalledWith(
          USER_ID,
          expect.objectContaining({ destinationKey: "admin-vaults-new" }),
        );
      });
      // Deterministic nav short-circuit: the LLM is never consulted…
      expect(mockRunChatAgent).not.toHaveBeenCalled();
      // …and the "section not found" reject is never emitted.
      expect(body).not.toContain("Je ne trouve pas cette section");
    });
  }

  // A non-product message from the same admin must NOT divert to the workspace.
  it('"quelle est la tension en volts" → no workspace nav (electrical, not a vault)', async () => {
    await POST(makeChatRequest("quelle est la tension en volts"));
    expect(mockPublishNav).not.toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ destinationKey: "admin-vaults-new" }),
    );
  });
});
