import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({ logger: { warn: vi.fn() } }));

import {
  classifyProductIntentLlm,
  type ClassifyClient,
} from "@/lib/llm/classify-product-intent";

/** Fake client returning a fixed JSON content (or throwing). */
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

describe("classifyProductIntentLlm", () => {
  it("recognizes an indirect creation intent and extracts the objective", async () => {
    const res = await classifyProductIntentLlm(
      fakeClient(
        JSON.stringify({
          isProductIntent: true,
          kind: "product_creation",
          objective: "Monter un véhicule défensif à dominante stable",
          wantsSimulation: false,
        }),
      ),
      "gpt-4.1",
      "monte-moi un truc défensif",
    );
    expect(res.isProductIntent).toBe(true);
    expect(res.kind).toBe("product_creation");
    expect(res.objective).toBe("Monter un véhicule défensif à dominante stable");
    expect(res.wantsSimulation).toBe(false);
  });

  it("flags a mixed create+simulate intent with wantsSimulation", async () => {
    const res = await classifyProductIntentLlm(
      fakeClient(
        JSON.stringify({
          isProductIntent: true,
          kind: "mixed_product_creation_simulation",
          objective: "Créer un vault BTC Plus et le stresser",
          wantsSimulation: true,
        }),
      ),
      "gpt-4.1",
      "fais un vault BTC plus et stress-teste-le",
    );
    expect(res.isProductIntent).toBe(true);
    expect(res.kind).toBe("mixed_product_creation_simulation");
    expect(res.wantsSimulation).toBe(true);
  });

  it("treats a plain product question as NOT a product intent", async () => {
    const res = await classifyProductIntentLlm(
      fakeClient(
        JSON.stringify({
          isProductIntent: false,
          kind: "none",
          objective: "",
          wantsSimulation: false,
        }),
      ),
      "gpt-4.1",
      "c'est quoi le vault Yield ?",
    );
    expect(res.isProductIntent).toBe(false);
    expect(res.kind).toBe("none");
    expect(res.objective).toBeUndefined();
  });

  it("downgrades a pure-simulation label to not-a-product-intent", async () => {
    // The workspace is a PRODUCT surface; a pure simulation must not divert here.
    const res = await classifyProductIntentLlm(
      fakeClient(
        JSON.stringify({
          isProductIntent: true,
          kind: "explicit_simulation",
          objective: "Stresser le vault existant",
          wantsSimulation: true,
        }),
      ),
      "gpt-4.1",
      "stress-teste le vault Yield",
    );
    expect(res.isProductIntent).toBe(false);
  });

  it("is fail-safe on malformed JSON (returns not-a-product-intent)", async () => {
    const res = await classifyProductIntentLlm(
      fakeClient("not json at all {{{"),
      "gpt-4.1",
      "créer un vault",
    );
    expect(res.isProductIntent).toBe(false);
  });

  it("is fail-safe when the model call throws", async () => {
    const res = await classifyProductIntentLlm(
      fakeClient(() => {
        throw new Error("openai down");
      }),
      "gpt-4.1",
      "créer un vault",
    );
    expect(res.isProductIntent).toBe(false);
  });

  it("returns not-a-product-intent for an empty message without calling the model", async () => {
    const create = vi.fn();
    const spyClient = { chat: { completions: { create } } } as unknown as ClassifyClient;
    const res = await classifyProductIntentLlm(spyClient, "gpt-4.1", "   ");
    expect(res.isProductIntent).toBe(false);
    expect(create).not.toHaveBeenCalled();
  });
});
