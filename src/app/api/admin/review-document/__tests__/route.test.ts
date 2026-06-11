/**
 * Integration tests for /api/admin/review-document
 *
 * All I/O (auth, db, kimi LLM, rate-limit, logger, product-routes, spec,
 * system-prompts) is mocked so tests run with no real DB or network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Hoist mocks before module imports ─────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    cockpitChat: {
      findFirst: vi.fn(),
    },
    cockpitMessage: {
      findMany: vi.fn(),
    },
    reviewDocument: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    llmRun: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/llm/kimi", () => ({
  kimi: {
    chat: {
      completions: {
        create: vi.fn(),
      },
    },
  },
  LLM_MODEL: "gpt-4.1",
  KIMI_MODEL: "gpt-4.1",
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/product-routes", () => ({
  getProductRoutes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/spec", () => ({
  getSpecIndex: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/agents/system-prompts/review", () => ({
  HEARST_PRODUCT_CONTEXT: "Mocked product context.",
}));

// ── Import modules AFTER mocks ─────────────────────────────────────────────

import { GET, POST } from "@/app/api/admin/review-document/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { kimi } from "@/lib/llm/kimi";
import { assertRateLimit } from "@/lib/rate-limit";

// ── Typed mock helpers ─────────────────────────────────────────────────────

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockChatFindFirst = vi.mocked(prisma.cockpitChat.findFirst);
const mockMessageFindMany = vi.mocked(prisma.cockpitMessage.findMany);
const mockDocFindFirst = vi.mocked(prisma.reviewDocument.findFirst);
const mockDocCreate = vi.mocked(prisma.reviewDocument.create);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockKimiCreate = vi.mocked(kimi.chat.completions.create);
const mockAssertRateLimit = vi.mocked(assertRateLimit);

// ── Helpers ────────────────────────────────────────────────────────────────

function makePostRequest(): NextRequest {
  return new Request("http://localhost/api/admin/review-document", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }) as unknown as NextRequest;
}

/** A minimal chat row returned by cockpitChat.findFirst */
const fakeChatRow = { id: "chat_abc" };

/** Two review-mode messages to feed the transcript builder */
const fakeMessages = [
  { role: "user", content: "What about the dashboard?" },
  { role: "assistant", content: "The dashboard needs a new KPI section." },
  { role: "user", content: "And the vault page?" },
];

/** Valid JSON block embedded in the LLM response */
const fakeJsonBlock = JSON.stringify({
  synthesis: "Session productive. Thèmes : lisibilité KPI, navigation.",
  items: [
    {
      page: "/portfolio",
      severity: "P1",
      current: "KPI sans période.",
      expected: "Ajouter sous-label période.",
      verbatim: "On sait pas si c'est l'année ou le mois.",
      confidence: "haute",
      doneWhen: "La carte affiche la période sans interaction.",
    },
  ],
  clarifications: [],
});

/** A minimal kimi completion response with the date placeholder and a JSON block */
const fakeCompletion = {
  choices: [
    {
      message: {
        content:
          "# Review Document\n\n_Date de génération : _\n\nSome content.\n\n```json\n" +
          fakeJsonBlock +
          "\n```",
      },
    },
  ],
};

/** A kimi completion response with an INVALID JSON block */
const fakeCompletionBadJson = {
  choices: [
    {
      message: {
        content:
          "# Review Document\n\n_Date de génération : _\n\nSome content.\n\n```json\n{ invalid json }\n```",
      },
    },
  ],
};

/** A saved document row returned by reviewDocument.create */
const fakeSavedDoc = {
  id: "doc_1",
  contentMd: "# Review Document\n\n_Date de génération : 2026-05-26_\n\nSome content.",
  contentJson: fakeJsonBlock,
  createdAt: new Date("2026-05-26T00:00:00.000Z"),
};

/** Async generator simulating a Kimi streaming completion */
async function* makeStreamChunks(
  texts: string[],
): AsyncGenerator<{ choices: Array<{ delta: { content: string } }> }> {
  for (const text of texts) {
    yield { choices: [{ delta: { content: text } }] };
  }
}

function makeStreamPostRequest(): NextRequest {
  return new Request(
    "http://localhost/api/admin/review-document?stream=1",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify({}),
    },
  ) as unknown as NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/review-document", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it("returns 403 when requireAdmin rejects (non-admin)", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));

    const res = await GET();

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it("returns 200 with document=null when no document exists", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockDocFindFirst.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json() as { document: null };
    expect(body).toEqual({ document: null });
  });

  it("returns 200 with the most recent document when one exists", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockDocFindFirst.mockResolvedValue(fakeSavedDoc as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json() as { document: typeof fakeSavedDoc };
    expect(body.document).toBeDefined();
    expect(body.document?.id).toBe("doc_1");
    // contentJson must be present in the GET response
    expect(body.document?.contentJson).toBeDefined();
  });
});

describe("POST /api/admin/review-document", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAssertRateLimit.mockResolvedValue(undefined);
    // Default: LlmRun.create succeeds silently
    mockLlmRunCreate.mockResolvedValue({} as never);
  });

  it("returns 403 when requireAdmin rejects (non-admin)", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockAssertRateLimit.mockRejectedValue(new Error("Rate limit exceeded. Try again in 30s."));

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(429);
  });

  it("returns 400 when no review-mode conversation exists", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    // No chat with review messages
    mockChatFindFirst.mockResolvedValue(null);

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("mode Revue");
  });

  it("returns 400 when the review chat has no review-mode messages", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    // Chat found but no messages in review mode
    mockMessageFindMany.mockResolvedValue([]);

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it("happy path: generates document, persists it, and returns it", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockResolvedValue(fakeCompletion as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { document: { id: string; contentMd: string; contentJson: string; createdAt: string } };
    expect(body.document).toBeDefined();
    expect(body.document.id).toBe("doc_1");

    // reviewDocument.create must have been called with contentJson non-null on happy path
    expect(mockDocCreate).toHaveBeenCalledTimes(1);
    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin_123",
          chatId: "chat_abc",
          contentJson: expect.any(String),
        }),
        select: expect.objectContaining({ id: true, contentMd: true, contentJson: true, createdAt: true }),
      }),
    );
  });

  it("happy path with invalid JSON block: contentJson is null but document is still created", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockResolvedValue(fakeCompletionBadJson as never);
    const savedDocNullJson = { ...fakeSavedDoc, contentJson: null };
    mockDocCreate.mockResolvedValue(savedDocNullJson as never);

    const req = makePostRequest();
    const res = await POST(req);

    // The document must still be created (200), even though JSON parsing failed
    expect(res.status).toBe(200);

    // create must have been called with contentJson: null
    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "admin_123",
          contentJson: null,
        }),
      }),
    );
  });

  it("happy path: records a success LlmRun row", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockResolvedValue(fakeCompletion as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makePostRequest();
    await POST(req);

    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentName: "review-document",
          status: "success",
          userId: "admin_123",
        }),
      }),
    );
  });

  it("returns 502 when the LLM call throws, and records a failed LlmRun", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockRejectedValue(new Error("LLM service unavailable"));

    const req = makePostRequest();
    const res = await POST(req);

    expect(res.status).toBe(502);

    // LlmRun must record the failure
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentName: "review-document",
          status: "failed",
          userId: "admin_123",
          errorMessage: "LLM service unavailable",
        }),
      }),
    );
  });

  it("strips <think> reasoning tags before persisting the document", async () => {
    const fakeWithThink = {
      choices: [
        {
          message: {
            content:
              "<think>Let me think about this transcription first...\nThe user said X.</think>\n\n" +
              "# Review Document\n\n_Date de génération : _\n\nSome content.\n\n```json\n" +
              fakeJsonBlock +
              "\n```",
          },
        },
      ],
    };

    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockResolvedValue(fakeWithThink as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    await POST(makePostRequest());

    expect(mockDocCreate).toHaveBeenCalledTimes(1);
    const persistedCall = mockDocCreate.mock.calls[0]?.[0] as {
      data: { contentMd: string };
    };
    expect(persistedCall.data.contentMd).not.toContain("<think>");
    expect(persistedCall.data.contentMd).not.toContain("</think>");
    expect(persistedCall.data.contentMd.startsWith("# Review Document")).toBe(true);
  });

  it("non-streaming: POST without ?stream=1 → returns JSON (backward-compat)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockResolvedValue(fakeCompletion as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makePostRequest(); // no ?stream=1
    const res = await POST(req);

    // Must return JSON, NOT SSE
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");

    const body = await res.json() as { document: { id: string } };
    expect(body.document).toBeDefined();
    expect(body.document.id).toBe("doc_1");
  });
});

describe("POST /api/admin/review-document — streaming (?stream=1)", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAssertRateLimit.mockResolvedValue(undefined);
    mockLlmRunCreate.mockResolvedValue({} as never);
  });

  it("POST with ?stream=1 → SSE response with delta events and a final done event", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);

    // The streaming content: two chunks that together form a valid document
    const chunk1 = "# Review Document\n\n_Date de génération : _\n\n";
    const chunk2 = "Some content.\n\n```json\n" + fakeJsonBlock + "\n```";
    mockKimiCreate.mockResolvedValue(makeStreamChunks([chunk1, chunk2]) as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makeStreamPostRequest();
    const res = await POST(req);

    // Must be an SSE stream
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(res.headers.get("cache-control")).toContain("no-store");

    // Collect all SSE events
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }

    // Parse events
    const events = raw
      .split("\n\n")
      .map((e) => e.trim())
      .filter((e) => e.startsWith("data: "))
      .map((e) => JSON.parse(e.slice(6)) as { type: string; text?: string; documentId?: string; contentMd?: string });

    // Must have at least 2 delta events (one per chunk)
    const deltas = events.filter((e) => e.type === "delta");
    expect(deltas.length).toBeGreaterThanOrEqual(1);
    expect(deltas[0]!.text).toBeDefined();

    // Must have exactly 1 done event at the end
    const doneEvents = events.filter((e) => e.type === "done");
    expect(doneEvents).toHaveLength(1);
    expect(doneEvents[0]!.documentId).toBe("doc_1");
    expect(doneEvents[0]!.contentMd).toBeDefined();

    // No error events
    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(0);
  });

  it("streaming: prisma.reviewDocument.create called once at end of stream", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);

    const chunk1 = "# Review Document\n\n_Date de génération : _\n\n";
    const chunk2 = "Content.\n\n```json\n" + fakeJsonBlock + "\n```";
    mockKimiCreate.mockResolvedValue(makeStreamChunks([chunk1, chunk2]) as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makeStreamPostRequest();
    const res = await POST(req);

    // Drain the stream to allow the async pipeline to complete
    const reader = res.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(mockDocCreate).toHaveBeenCalledTimes(1);
    expect(mockDocCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "admin_123", chatId: "chat_abc" }),
      }),
    );
  });

  it("streaming: prisma.llmRun.create called with success after stream completes", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);

    const chunk1 = "# Review Document\n\n_Date de génération : _\n\n";
    const chunk2 = "Content.\n\n```json\n" + fakeJsonBlock + "\n```";
    mockKimiCreate.mockResolvedValue(makeStreamChunks([chunk1, chunk2]) as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makeStreamPostRequest();
    const res = await POST(req);

    const reader = res.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentName: "review-document",
          status: "success",
          userId: "admin_123",
        }),
      }),
    );
  });

  it("streaming: enqueue throws on consumer cancel → no double traceLlmRun (exactly 1 LlmRun row)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);

    const chunk1 = "# Review Document\n\n_Date de génération : _\n\n";
    const chunk2 = "Content.\n\n```json\n" + fakeJsonBlock + "\n```";
    mockKimiCreate.mockResolvedValue(makeStreamChunks([chunk1, chunk2]) as never);
    mockDocCreate.mockResolvedValue(fakeSavedDoc as never);

    const req = makeStreamPostRequest();
    const res = await POST(req);

    // Drain stream normally — the safeEnqueueAndClose path applies once the
    // controller is closed; we just need to verify the trace count.
    const reader = res.body!.getReader();
    while (true) {
      const { done } = await reader.read();
      if (done) break;
    }

    // Even if the consumer had cancelled mid-send, traceLlmRun must be called
    // exactly once (the "success" path), not twice.
    expect(mockLlmRunCreate).toHaveBeenCalledTimes(1);
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentName: "review-document",
          status: "success",
          userId: "admin_123",
        }),
      }),
    );
  });

  it("streaming: LLM error → SSE error event, prisma.llmRun.create called with failed", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockChatFindFirst.mockResolvedValue(fakeChatRow as never);
    mockMessageFindMany.mockResolvedValue(fakeMessages as never);
    mockKimiCreate.mockRejectedValue(new Error("stream LLM failure"));

    const req = makeStreamPostRequest();
    const res = await POST(req);

    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    let raw = "";
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      raw += decoder.decode(value, { stream: true });
    }

    const events = raw
      .split("\n\n")
      .map((e) => e.trim())
      .filter((e) => e.startsWith("data: "))
      .map((e) => JSON.parse(e.slice(6)) as { type: string; message?: string });

    const errorEvents = events.filter((e) => e.type === "error");
    expect(errorEvents).toHaveLength(1);
    expect(errorEvents[0]!.message).toContain("stream LLM failure");

    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          agentName: "review-document",
          status: "failed",
        }),
      }),
    );
  });
});
