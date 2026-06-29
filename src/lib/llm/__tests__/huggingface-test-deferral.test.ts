import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Guard for the CI/test deferral contract of huggingface.ts.
 *
 * Regression context: the module threw at import when no HF token was set. In CI
 * (Vitest, no HF secret) that crashed every importer of semantic-guard (chat-agent,
 * route guards…) → ~3 suites at "0 test". The fix defers the missing-token error
 * to first USE under NODE_ENV==="test" (and next build), exactly like openai.ts.
 *
 * We mock `@/lib/env` so the only variable under test is the HF token presence,
 * then re-import the module fresh per case. Asserts:
 *  - no token → import does NOT throw, HF_AVAILABLE=false, client throws on USE,
 *  - token present → HF_AVAILABLE=true.
 */

const baseEnv = {
  HF_ZEROSHOT_MODEL: "joeddav/xlm-roberta-large-xnli",
  SEMANTIC_GUARD: "0",
};

function mockEnv(over: Record<string, unknown>) {
  vi.doMock("@/lib/env", () => ({ env: { ...baseEnv, ...over } }));
}

describe("huggingface.ts — missing-token deferral under test", () => {
  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.resetModules();
  });

  it("loads without throwing when no HF token is set (NODE_ENV=test)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockEnv({ HF_TOKEN: undefined, HUGGINGFACE_API_KEY: undefined });
    vi.resetModules();

    const mod = await import("@/lib/llm/huggingface");
    expect(mod.HF_AVAILABLE).toBe(false);
    expect(mod.huggingface).toBeDefined();
    vi.unstubAllEnvs();
  });

  it("placeholder client throws on first USE (no silent live HF call)", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockEnv({ HF_TOKEN: undefined, HUGGINGFACE_API_KEY: undefined });
    vi.resetModules();

    const mod = await import("@/lib/llm/huggingface");
    expect(() =>
      (
        mod.huggingface as unknown as { zeroShotClassification: () => void }
      ).zeroShotClassification(),
    ).toThrow(/HF_TOKEN/);
    vi.unstubAllEnvs();
  });

  it("HF_AVAILABLE is true when a token is present", async () => {
    vi.stubEnv("NODE_ENV", "test");
    mockEnv({ HF_TOKEN: "hf_test_token_value" });
    vi.resetModules();

    const mod = await import("@/lib/llm/huggingface");
    expect(mod.HF_AVAILABLE).toBe(true);
    vi.unstubAllEnvs();
  });
});
