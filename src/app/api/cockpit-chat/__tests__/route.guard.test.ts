import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

import { BLOCK_SENTINEL } from "@/lib/llm/output-guard";

/**
 * End-to-end compliance-guard test for the DEFAULT production path: normal mode
 * with CHAT_MASTER_AGENT OFF, where POST /api/cockpit-chat falls through to the
 * @hearst/cockpit-shell handler and wraps its stream with `guardChatStream`.
 *
 * The other route test file pins the flag ON (Master Agent path); this one pins
 * it OFF so we exercise the cockpit-shell branch real LPs hit today, and asserts
 * a non-compliant model answer is BLOCKED before any forbidden span reaches the
 * user — the only seam that was previously unit-tested per-component but never
 * end-to-end on the route.
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

// The point of this file: the Master Agent flag is OFF, so the route uses the
// cockpit-shell handler path (the prod default for LPs).
vi.mock("@/lib/feature-flags", () => ({
  FEATURE_FLAGS: { CHAT_MASTER_AGENT: false },
}));

vi.mock("@/lib/llm/openai", () => ({
  openai: {},
  LLM_MODEL: "gpt-4.1",
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminChatMode: { findUnique: vi.fn().mockResolvedValue({ mode: "normal" }) },
    llmRun: { create: vi.fn().mockResolvedValue({}) },
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

// Mock the shared cockpit-shell handler so we control the streamed answer. The
// route wraps `res.body` with guardChatStream, so a non-compliant body here
// must be blocked before it reaches the client.
const mockHandlerPost = vi.fn();
vi.mock("@hearst/cockpit-shell/handler", () => ({
  createCockpitChatHandler: vi.fn(() => ({ POST: mockHandlerPost })),
}));

import { POST } from "@/app/api/cockpit-chat/route";
import { requireAuth } from "@/lib/auth/require-auth";

const mockRequireAuth = vi.mocked(requireAuth);
const USER_ID = "lp-guard-test";

function makeChatRequest(message: string): NextRequest {
  return new Request("http://localhost/api/cockpit-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  }) as NextRequest;
}

function handlerResponseStreaming(text: string): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
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

describe("POST /api/cockpit-chat — normal-mode compliance guard (flag OFF, cockpit-shell path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireAuth.mockResolvedValue({ userId: USER_ID });
  });

  it("streams a compliant answer through unchanged", async () => {
    const compliant = "Le vault vise une fourchette d'APY de 8 à 15 %, non garantie.";
    mockHandlerPost.mockResolvedValue(handlerResponseStreaming(compliant));

    const res = await POST(makeChatRequest("Quel est le rendement ?"));
    expect(res.status).toBe(200);

    const body = await readAll(res);
    expect(body).toBe(compliant);
    expect(body).not.toContain(BLOCK_SENTINEL);
  });

  it("blocks a forbidden-words answer before it reaches the user", async () => {
    const forbidden =
      "Ce produit offre un rendement garanti, sans aucun risque pour votre capital.";
    mockHandlerPost.mockResolvedValue(handlerResponseStreaming(forbidden));

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
    mockHandlerPost.mockResolvedValue(handlerResponseStreaming(singlePoint));

    const res = await POST(makeChatRequest("c'est quoi l'APY exact ?"));
    expect(res.status).toBe(200);

    const body = await readAll(res);
    expect(body).toContain(BLOCK_SENTINEL);
    expect(body).not.toContain("APY de 11 %");
  });
});
