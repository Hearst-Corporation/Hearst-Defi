import { describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    mockPrisma: {
      llmRun: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const id = crypto.randomUUID();
          const row = { id, ...data };
          rows.set(id, row);
          return row;
        }),
        update: vi.fn(
          async ({
            where,
            data,
          }: {
            where: { id: string };
            data: Record<string, unknown>;
          }) => {
            const prev = rows.get(where.id) ?? { id: where.id };
            const row = { ...prev, ...data, id: where.id };
            rows.set(where.id, row);
            return row;
          },
        ),
        findUniqueOrThrow: vi.fn(async ({ where }: { where: { id: string } }) => {
          const row = rows.get(where.id);
          if (!row) throw new Error(`LlmRun ${where.id} not found`);
          return row;
        }),
      },
    },
  };
});

vi.mock("@/lib/db", () => ({
  prisma: mockPrisma,
}));

import { callLlm } from "@/lib/llm/client";
import { LLM_MODEL } from "@/lib/llm/openai";
import { withRequestContext } from "@/lib/request-context";

/** A minimal OpenAI-SDK-style error: an Error carrying an HTTP `status`. The
 *  client classifies retryability by the numeric `status` property, not by any
 *  SDK class, so this is sufficient. */
function apiError(status: number, message: string): Error {
  const err = new Error(message) as Error & { status: number };
  err.status = status;
  return err;
}

describe("callLlm", () => {
  it("returns the LLM response on success", async () => {
    const mockResponse = {
      content: [{ type: "text" as const, text: '{"result":"ok"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    const mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue(mockResponse),
      },
    };

    const result = await callLlm(
      "test-agent",
      {
        model: LLM_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user" as const, content: "hello" }],
      },
      { client: mockClient },
    );

    expect(result.response).toBe(mockResponse);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
  });

  it("retries on 429 and eventually succeeds", async () => {
    const mockResponse = {
      content: [{ type: "text" as const, text: '{"result":"ok"}' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    const error429 = apiError(429, "Rate limited");

    const mockClient = {
      messages: {
        create: vi
          .fn()
          .mockRejectedValueOnce(error429)
          .mockResolvedValueOnce(mockResponse),
      },
    };

    const result = await callLlm(
      "test-agent",
      {
        model: LLM_MODEL,
        max_tokens: 1024,
        messages: [{ role: "user" as const, content: "hello" }],
      },
      { client: mockClient, maxRetries: 2 },
    );

    expect(result.response).toBe(mockResponse);
    expect(mockClient.messages.create).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on 500", async () => {
    const error500 = apiError(500, "Server error");

    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(error500),
      },
    };

    await expect(
      callLlm(
        "test-agent",
        {
          model: LLM_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user" as const, content: "hello" }],
        },
        { client: mockClient, maxRetries: 2 },
      ),
    ).rejects.toThrow("Server error");

    expect(mockClient.messages.create).toHaveBeenCalledTimes(2);
  });

  it("does not retry on 400", async () => {
    const error400 = apiError(400, "Bad request");

    const mockClient = {
      messages: {
        create: vi.fn().mockRejectedValue(error400),
      },
    };

    await expect(
      callLlm(
        "test-agent",
        {
          model: LLM_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user" as const, content: "hello" }],
        },
        { client: mockClient, maxRetries: 3 },
      ),
    ).rejects.toThrow("Bad request");

    expect(mockClient.messages.create).toHaveBeenCalledTimes(1);
  });

  describe("cost + observability", () => {
    // GPT-4.1 per-million-token pricing, mirrored from client.ts (ADR-011).
    const OPENAI_INPUT_PER_M = 2.0;
    const OPENAI_OUTPUT_PER_M = 8.0;

    it("bills OpenAI pricing and records the system-prompt hash", async () => {
      const mockResponse = {
        content: [{ type: "text" as const, text: "{}" }],
        usage: { input_tokens: 1000, output_tokens: 200 },
      };
      const mockClient = {
        messages: { create: vi.fn().mockResolvedValue(mockResponse) },
      };

      const { runId } = await callLlm(
        "test-cost",
        {
          model: LLM_MODEL,
          max_tokens: 1024,
          system: "system prompt A",
          messages: [{ role: "user" as const, content: "hello" }],
        },
        { client: mockClient },
      );

      const row = await mockPrisma.llmRun.findUniqueOrThrow({ where: { id: runId } });
      expect(row.systemPromptHash).toMatch(/^[a-f0-9]{64}$/);
      const expectedCost =
        (1000 * OPENAI_INPUT_PER_M + 200 * OPENAI_OUTPUT_PER_M) / 1_000_000;
      expect(row.costUsd).toBeCloseTo(expectedCost, 10);
    });
  });

  describe("userId propagation from request context", () => {
    const successResponse = {
      content: [{ type: "text" as const, text: "{}" }],
      usage: { input_tokens: 10, output_tokens: 5 },
    };

    it("persists userId when callLlm runs inside a request context", async () => {
      const mockClient = {
        messages: { create: vi.fn().mockResolvedValue(successResponse) },
      };

      const { runId } = await withRequestContext(
        { requestId: "req-test-1", userId: "user_123" },
        () =>
          callLlm(
            "test-userid-set",
            {
              model: LLM_MODEL,
              max_tokens: 1024,
              messages: [{ role: "user" as const, content: "hello" }],
            },
            { client: mockClient },
          ),
      );

      const row = await mockPrisma.llmRun.findUniqueOrThrow({ where: { id: runId } });
      expect(row.userId).toBe("user_123");
    });

    it("persists userId as null when callLlm runs outside any request context", async () => {
      const mockClient = {
        messages: { create: vi.fn().mockResolvedValue(successResponse) },
      };

      const { runId } = await callLlm(
        "test-userid-null",
        {
          model: LLM_MODEL,
          max_tokens: 1024,
          messages: [{ role: "user" as const, content: "hello" }],
        },
        { client: mockClient },
      );

      const row = await mockPrisma.llmRun.findUniqueOrThrow({ where: { id: runId } });
      expect(row.userId).toBeNull();
    });
  });
});
