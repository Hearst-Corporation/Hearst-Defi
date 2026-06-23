import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import { classifyCanvasIntentLlm } from "@/lib/canvas/classify-canvas-intent";
import type { ClassifyClient } from "@/lib/llm/classify-product-intent";

function fakeClient(content: string | (() => never)): ClassifyClient {
  return {
    chat: {
      completions: {
        create: async () => {
          if (typeof content === "function") content();
          return { choices: [{ message: { content: content as string } }] };
        },
      },
    },
  };
}

describe("classifyCanvasIntentLlm", () => {
  it("opens the outreach canvas on an outreach intent + extracts the objective", async () => {
    const res = await classifyCanvasIntentLlm(
      fakeClient(
        JSON.stringify({
          isOutreachIntent: true,
          objective: "Campagne cold pour distributeurs B2B",
        }),
      ),
      "gpt-4.1",
      "lance une campagne de prospection distributeurs",
    );
    expect(res?.canvasId).toBe("outreach");
    expect(res?.objective).toBe("Campagne cold pour distributeurs B2B");
  });

  it("returns null when it is not an outreach intent", async () => {
    const res = await classifyCanvasIntentLlm(
      fakeClient(JSON.stringify({ isOutreachIntent: false, objective: "" })),
      "gpt-4.1",
      "c'est quoi le vault Yield ?",
    );
    expect(res).toBeNull();
  });

  it("fail-safe: a thrown client error → null (never breaks the chat)", async () => {
    const res = await classifyCanvasIntentLlm(
      fakeClient(() => {
        throw new Error("boom");
      }),
      "gpt-4.1",
      "lance une campagne outreach",
    );
    expect(res).toBeNull();
  });

  it("fail-safe: malformed JSON → null", async () => {
    const res = await classifyCanvasIntentLlm(
      fakeClient("not json at all"),
      "gpt-4.1",
      "outreach",
    );
    expect(res).toBeNull();
  });

  it("empty message short-circuits to null without a model call", async () => {
    const res = await classifyCanvasIntentLlm(fakeClient("{}"), "gpt-4.1", "   ");
    expect(res).toBeNull();
  });
});
