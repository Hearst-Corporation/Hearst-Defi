import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { BLOCK_SENTINEL } from "@/lib/llm/output-guard";

/**
 * End-to-end compliance-guard test for the SINGLE chat engine.
 *
 * The dual-engine was retired: ALL modes now run through the app-side
 * tool-capable engine (`runChatAgent`), whose stream is wrapped by
 * `guardChatStream` internally. This file drives the REAL `runChatAgent` with a
 * fake streaming OpenAI client and asserts a non-compliant model answer is
 * BLOCKED before any forbidden span reaches the user — the guard seam that the
 * other route test (which stubs `runChatAgent`) does not exercise.
 *
 * It also pins the kill-switch behaviour: CHAT_MASTER_AGENT="0" → 503, no engine.
 */

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/auth/session", () => ({
  getSession: vi.fn().mockResolvedValue({ role: "investor" }),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Single engine ON. A separate test toggles this to false to assert the 503
// kill-switch (the mock object is mutable, unlike the `as const` source).
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: true },
}));

// Configurable streaming OpenAI client. `mockCreate` returns an async-iterable of
// StreamChunks so the REAL runChatAgent consumes it and the REAL guardChatStream
// wraps the result. `vi.hoisted` so the variable exists when the hoisted
// vi.mock factory runs.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));
vi.mock("@/lib/llm/openai", () => ({
  openai: { chat: { completions: { create: mockCreate } } },
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
      count: vi.fn(),
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

// NOTE: @/lib/llm/chat-agent is deliberately NOT mocked — we drive the real
// engine so guardChatStream actually runs.

vi.mock("@/lib/llm/nav-channel", () => ({
  publishNav: vi.fn().mockResolvedValue(undefined),
}));

// No nav shortcut for these messages — keep the path deterministic on the LLM
// stream, not the regex fast-path.
vi.mock("@/lib/llm/nav-fallback-intent", () => ({
  resolveNavFallbackDestinationKey: vi.fn().mockReturnValue(null),
  NAV_SHORTCUT_ACK: "Je vous y emmène.",
}));

// Product-chart stream events are an orthogonal concern — pass the guarded
// stream through untouched so body assertions see exactly the guard's output.
vi.mock("@/lib/llm/product-chat-stream", () => ({
  withProductChatStreamEvents: (args: { stream: ReadableStream<Uint8Array> }) =>
    args.stream,
  inferVault: vi.fn(),
}));

// Deterministic product-workspace classifier — default: not a product intent.
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
import { prisma } from "@/lib/db";
import { FEATURE_FLAGS } from "@/lib/feature-flags";

const mockRequireAuth = vi.mocked(requireAuth);
const USER_ID = "lp-guard-test";

/** A one-chunk streaming completion of `text`, plus a terminal usage chunk —
 *  the minimal shape runChatAgent's consumeCompletion expects. */
function streamingCompletion(text: string): AsyncIterable<unknown> {
  return {
    async *[Symbol.asyncIterator]() {
      yield { choices: [{ delta: { content: text } }] };
      yield {
        choices: [],
        usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
      };
    },
  };
}

function makeChatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

async function readAll(res: Response): Promise<string> {
  if (!res.body) return "";
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    out += dec.decode(value, { stream: true });
  }
  out += dec.decode();
  return out;
}

describe("POST /api/cockpit-chat — compliance guard on the single engine", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (FEATURE_FLAGS as { CHAT_MASTER_AGENT: boolean }).CHAT_MASTER_AGENT = true;
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
    // Persistence resolves to sane values so the turn is not degraded.
    vi.mocked(prisma.adminChatMode.findUnique).mockResolvedValue({
      mode: "normal",
    } as never);
    vi.mocked(prisma.cockpitChat.create).mockResolvedValue({ id: "chat-1" } as never);
    vi.mocked(prisma.cockpitChat.findUnique).mockResolvedValue({
      userId: USER_ID,
    } as never);
    vi.mocked(prisma.cockpitChat.update).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitChat.updateMany).mockResolvedValue({ count: 0 } as never);
    vi.mocked(prisma.cockpitMessage.create).mockResolvedValue({} as never);
    vi.mocked(prisma.cockpitMessage.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.cockpitMessage.count).mockResolvedValue(1 as never);
    vi.mocked(prisma.llmRun.create).mockResolvedValue({} as never);
    vi.mocked(prisma.navTrace.create).mockResolvedValue({} as never);
  });

  it("streams a compliant answer through unchanged", async () => {
    const compliant = "Le vault vise une fourchette d'APY de 8 à 15 %, non garantie.";
    mockCreate.mockImplementation(async () => streamingCompletion(compliant));

    const res = await POST(makeChatRequest("Quel est le rendement ?"));
    expect(res.status).toBe(200);

    const body = await readAll(res);
    expect(body).toBe(compliant);
    expect(body).not.toContain(BLOCK_SENTINEL);
  });

  it("blocks a forbidden-words answer before it reaches the user", async () => {
    const forbidden =
      "Ce produit offre un rendement garanti, sans aucun risque pour votre capital.";
    mockCreate.mockImplementation(async () => streamingCompletion(forbidden));

    const res = await POST(makeChatRequest("garantis-moi du rendement"));
    expect(res.status).toBe(200);

    const body = await readAll(res);
    expect(body).toContain(BLOCK_SENTINEL);
    // The forbidden claim must never reach the client.
    expect(body).not.toContain("rendement garanti");
    expect(body).not.toContain("sans aucun risque");
  });

  it("blocks a single-point APY answer before it reaches the user", async () => {
    const singlePoint = "Le vault Hearst Yield délivre un APY de 11 % chaque mois.";
    mockCreate.mockImplementation(async () => streamingCompletion(singlePoint));

    const res = await POST(makeChatRequest("c'est quoi l'APY exact ?"));
    expect(res.status).toBe(200);

    const body = await readAll(res);
    expect(body).toContain(BLOCK_SENTINEL);
    expect(body).not.toContain("APY de 11 %");
  });

  it("returns 503 when the kill-switch is off (no fallback engine)", async () => {
    (FEATURE_FLAGS as { CHAT_MASTER_AGENT: boolean }).CHAT_MASTER_AGENT = false;
    mockCreate.mockImplementation(async () => streamingCompletion("anything"));

    const res = await POST(makeChatRequest("hello"));
    expect(res.status).toBe(503);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
