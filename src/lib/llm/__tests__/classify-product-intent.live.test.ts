/**
 * LIVE classifier check — makes REAL OpenAI calls. Excluded from the normal
 * suite; run explicitly:
 *   npx vitest run src/lib/llm/__tests__/classify-product-intent.live.test.ts
 *
 * Proves the classifier actually recognizes product intents (the piece that
 * cannot be verified with a mocked client). Costs a few small OpenAI calls.
 */
import { describe, expect, it } from "vitest";

import { openai, LLM_MODEL } from "@/lib/llm/openai";
import {
  classifyProductIntentLlm,
  type ClassifyClient,
} from "@/lib/llm/classify-product-intent";

const client = openai as unknown as ClassifyClient;

describe("classifyProductIntentLlm — LIVE (real OpenAI)", () => {
  it("recognizes an indirect creation phrasing", async () => {
    const res = await classifyProductIntentLlm(
      client,
      LLM_MODEL,
      "monte-moi un vault défensif",
    );
    // eslint-disable-next-line no-console
    console.log("[live] 'monte-moi un vault défensif' →", JSON.stringify(res));
    expect(res.isProductIntent).toBe(true);
    expect(res.objective && res.objective.length > 0).toBe(true);
  }, 20_000);

  it("does NOT flag a plain product question", async () => {
    const res = await classifyProductIntentLlm(
      client,
      LLM_MODEL,
      "c'est quoi le vault Yield ?",
    );
    // eslint-disable-next-line no-console
    console.log("[live] 'c'est quoi le vault Yield ?' →", JSON.stringify(res));
    expect(res.isProductIntent).toBe(false);
  }, 20_000);

  it("recognizes an explicit creation request", async () => {
    const res = await classifyProductIntentLlm(
      client,
      LLM_MODEL,
      "Créer un nouveau vault BTC Plus",
    );
    // eslint-disable-next-line no-console
    console.log("[live] 'Créer un nouveau vault BTC Plus' →", JSON.stringify(res));
    expect(res.isProductIntent).toBe(true);
  }, 20_000);
});
