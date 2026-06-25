/**
 * Route-level tests for the Agentic Router Stabilization lot:
 *
 *  1. NEGATION GUARD — a negated navigation ("ne montre pas les vaults",
 *     "n'ouvre pas le portefeuille") must NOT publish nav, even though the legacy
 *     regex resolver (which ignores negation) still resolves a destination key.
 *     The router is the source of truth for negation; the legacy fallback is now
 *     gated on `!agenticDecision.negated`.
 *
 *  2. EDUCATIONAL READ-ONLY STEERING — a read-only educational question
 *     (product / yield / risk explanation) reaches the LLM with the educational
 *     directive appended to the system prompt. This steers the register; it does
 *     NOT relax the compliance guard (that stays inside runChatAgent/output-guard).
 *
 *  3. DANGEROUS REFUSAL — a deploy/go-live request is refused BEFORE the LLM with
 *     no nav publish and no chat-agent call.
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

/** The system prompt passed to runChatAgent on the most recent call. */
function systemPromptOfLastTurn(): string {
  const call = mockRunChatAgent.mock.calls.at(-1);
  if (!call) return "";
  const messages = call[2] as Array<{ role: string; content: string }>;
  return messages.find((m) => m.role === "system")?.content ?? "";
}

describe("cockpit-chat — router stabilization (negation, education, refusal)", () => {
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

  // ── 1. NEGATION GUARD ────────────────────────────────────────────────────
  describe("negated navigation never publishes nav", () => {
    for (const msg of [
      "ne montre pas les vaults",
      "n'ouvre pas le portefeuille",
      "ne pas ouvrir le portefeuille",
    ]) {
      it(`"${msg}" → no publishNav, falls through to LLM`, async () => {
        await POST(makeChatRequest(msg));
        // The legacy regex resolves a key for these, but the negation guard
        // blocks the publish — the router classified them as cancellation.
        expect(mockPublishNav).not.toHaveBeenCalled();
        // It still reaches the LLM (the message is answered, not nav'd).
        expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
      });
    }

    it('positive "montre les vaults" still publishes nav (no regression)', async () => {
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

  // ── 2. EDUCATIONAL READ-ONLY STEERING ────────────────────────────────────
  describe("educational read-only intents steer the system prompt", () => {
    for (const msg of [
      "explique-moi comment marchent les produits",
      "explique comment fonctionne le yield",
      "quels sont les risques d'un produit",
    ]) {
      it(`"${msg}" → LLM called with educational directive in system prompt`, async () => {
        await POST(makeChatRequest(msg));
        expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
        const sys = systemPromptOfLastTurn();
        expect(sys).toContain("INTENT : question ÉDUCATIVE read-only");
        // The directive reinforces (never relaxes) compliance.
        expect(sys).toContain("fourchette");
        expect(sys).toMatch(/mot interdit|garanti/i);
      });
    }

    it("a non-educational chat does NOT get the educational directive", async () => {
      await POST(makeChatRequest("bonjour, tu vas bien ?"));
      expect(mockRunChatAgent).toHaveBeenCalledTimes(1);
      expect(systemPromptOfLastTurn()).not.toContain(
        "INTENT : question ÉDUCATIVE read-only",
      );
    });
  });

  // ── 3. DANGEROUS REFUSAL ─────────────────────────────────────────────────
  describe("dangerous intents refuse before the LLM", () => {
    for (const msg of [
      "déploie ce produit",
      "mets ce vault en ligne",
      "envoie la campagne aux prospects",
      "source des prospects institutionnels",
    ]) {
      it(`"${msg}" → refusal, no LLM, no nav publish`, async () => {
        const res = await POST(makeChatRequest(msg));
        expect(res.status).toBe(200);
        const body = await res.text();
        expect(body).toContain("Je ne peux pas exécuter cette demande");
        expect(mockRunChatAgent).not.toHaveBeenCalled();
        expect(mockPublishNav).not.toHaveBeenCalled();
      });
    }
  });
});
