import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// server-only is a no-op marker in tests.
vi.mock("server-only", () => ({}));

// Hoisted mock handles so the vi.mock factories can reference them.
const { mockZeroShot, hfState } = vi.hoisted(() => ({
  mockZeroShot: vi.fn(),
  hfState: { available: true },
}));

// Mock the HF client module — no real network, no token, no API spend.
vi.mock("@/lib/llm/huggingface", () => ({
  get HF_AVAILABLE() {
    return hfState.available;
  },
  HF_ZEROSHOT_MODEL: "mock/model",
  huggingface: {
    zeroShotClassification: mockZeroShot,
  },
}));

// Mutable env mock so each test can pick the SEMANTIC_GUARD mode.
const { envState } = vi.hoisted(() => ({
  envState: { SEMANTIC_GUARD: undefined as string | undefined },
}));
vi.mock("@/lib/env", () => ({
  get env() {
    return { SEMANTIC_GUARD: envState.SEMANTIC_GUARD };
  },
}));

import {
  classifyReturnPromise,
  semanticGuardMode,
  semanticViolationBeyondKeywords,
  SEMANTIC_GUARD_THRESHOLD,
} from "@/lib/llm/semantic-guard";

/** Build a zero-shot output array with a given top score on label[0]. */
function zsOutput(topScore: number): Array<{ label: string; score: number }> {
  return [
    { label: "This text promises or guarantees an investment return.", score: topScore },
    { label: "Ce texte promet ou garantit un rendement.", score: topScore - 0.2 },
  ];
}

beforeEach(() => {
  mockZeroShot.mockReset();
  hfState.available = true;
  envState.SEMANTIC_GUARD = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("semanticGuardMode", () => {
  it("defaults to off when env is absent or '0'", () => {
    envState.SEMANTIC_GUARD = undefined;
    expect(semanticGuardMode()).toBe("off");
    envState.SEMANTIC_GUARD = "0";
    expect(semanticGuardMode()).toBe("off");
  });

  it("maps '1' and 'shadow' to shadow, 'enforce' to enforce", () => {
    envState.SEMANTIC_GUARD = "1";
    expect(semanticGuardMode()).toBe("shadow");
    envState.SEMANTIC_GUARD = "shadow";
    expect(semanticGuardMode()).toBe("shadow");
    envState.SEMANTIC_GUARD = "enforce";
    expect(semanticGuardMode()).toBe("enforce");
  });
});

describe("classifyReturnPromise", () => {
  it("returns null on empty text without calling HF", async () => {
    const v = await classifyReturnPromise("   ");
    expect(v).toBeNull();
    expect(mockZeroShot).not.toHaveBeenCalled();
  });

  it("returns null (and skips HF) when no token is available", async () => {
    hfState.available = false;
    const v = await classifyReturnPromise("guaranteed 12% returns");
    expect(v).toBeNull();
    expect(mockZeroShot).not.toHaveBeenCalled();
  });

  it("flags when top score ≥ threshold", async () => {
    mockZeroShot.mockResolvedValue(zsOutput(0.93));
    const v = await classifyReturnPromise("your capital is fully protected");
    expect(v).not.toBeNull();
    expect(v?.flagged).toBe(true);
    expect(v?.topScore).toBeCloseTo(0.93);
  });

  it("does not flag when top score is below threshold", async () => {
    mockZeroShot.mockResolvedValue(zsOutput(0.4));
    const v = await classifyReturnPromise("target APY range is 8-15%");
    expect(v?.flagged).toBe(false);
  });

  it("fails open (returns null) when HF throws", async () => {
    mockZeroShot.mockRejectedValue(new Error("network down"));
    const v = await classifyReturnPromise("anything");
    expect(v).toBeNull();
  });

  it("passes multi_label + candidate labels to HF", async () => {
    mockZeroShot.mockResolvedValue(zsOutput(0.1));
    await classifyReturnPromise("hello");
    expect(mockZeroShot).toHaveBeenCalledTimes(1);
    const arg = mockZeroShot.mock.calls[0]![0] as {
      inputs: string;
      parameters: { candidate_labels: string[]; multi_label: boolean };
    };
    expect(arg.inputs).toBe("hello");
    expect(arg.parameters.multi_label).toBe(true);
    expect(arg.parameters.candidate_labels.length).toBeGreaterThanOrEqual(3);
  });
});

describe("semanticViolationBeyondKeywords — mode behaviour", () => {
  it("off mode never calls HF and never blocks", async () => {
    envState.SEMANTIC_GUARD = undefined;
    const blocked = await semanticViolationBeyondKeywords("guaranteed gains", false);
    expect(blocked).toBe(false);
    expect(mockZeroShot).not.toHaveBeenCalled();
  });

  it("shadow mode never blocks even on a strong semantic hit", async () => {
    envState.SEMANTIC_GUARD = "shadow";
    mockZeroShot.mockResolvedValue(zsOutput(0.97));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const blocked = await semanticViolationBeyondKeywords(
      "you cannot lose money here",
      false,
    );
    expect(blocked).toBe(false);
    // divergence (flagged + keyword missed) → logged for calibration
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("enforce mode blocks a paraphrase the keyword guard missed", async () => {
    envState.SEMANTIC_GUARD = "enforce";
    mockZeroShot.mockResolvedValue(zsOutput(0.95));
    const blocked = await semanticViolationBeyondKeywords(
      "your capital is fully protected against any downside",
      false,
    );
    expect(blocked).toBe(true);
  });

  it("enforce mode does NOT double-count when keyword guard already caught it", async () => {
    envState.SEMANTIC_GUARD = "enforce";
    mockZeroShot.mockResolvedValue(zsOutput(0.95));
    const blocked = await semanticViolationBeyondKeywords("guarantee", true);
    expect(blocked).toBe(false); // keyword guard owns it; not a NEW violation
  });

  it("enforce mode does not block compliant range copy", async () => {
    envState.SEMANTIC_GUARD = "enforce";
    mockZeroShot.mockResolvedValue(zsOutput(0.3));
    const blocked = await semanticViolationBeyondKeywords(
      "target APY range 8-15%, not guaranteed",
      false,
    );
    expect(blocked).toBe(false);
  });
});

/**
 * GOLDEN CORPUS — paraphrased return-promises the KEYWORD guard misses by
 * construction (no forbidden needle), plus compliant phrasings that must NOT
 * be flagged. This is the calibration dataset: it documents the exact gap the
 * semantic layer exists to close. The HF model is mocked, so these assert the
 * WIRING (a high model score → blocked in enforce), not the model's accuracy —
 * model accuracy is validated separately against the live endpoint.
 */
describe("golden corpus — paraphrase gap (wiring)", () => {
  const PARAPHRASED_PROMISES: string[] = [
    "your capital is fully protected against any downside",
    "you will receive your 12% no matter what happens",
    "there is simply no way to lose money with this vault",
    "vous toucherez vos rendements quoi qu'il arrive",
    "votre capital ne peut pas baisser, c'est sûr",
    "these monthly payouts are locked in for you",
  ];

  const COMPLIANT_PHRASINGS: string[] = [
    "target APY range is 8-15%, returns are not guaranteed",
    "projected yield, subject to mining performance and not assured",
    "le rendement visé est une fourchette, non garanti",
  ];

  it.each(PARAPHRASED_PROMISES)(
    "enforce blocks paraphrased promise: %s",
    async (phrase) => {
      envState.SEMANTIC_GUARD = "enforce";
      mockZeroShot.mockResolvedValue(zsOutput(0.95)); // model recognises the promise
      const blocked = await semanticViolationBeyondKeywords(phrase, false);
      expect(blocked).toBe(true);
    },
  );

  it.each(COMPLIANT_PHRASINGS)(
    "enforce does not block compliant phrasing: %s",
    async (phrase) => {
      envState.SEMANTIC_GUARD = "enforce";
      mockZeroShot.mockResolvedValue(zsOutput(0.2)); // model sees no promise
      const blocked = await semanticViolationBeyondKeywords(phrase, false);
      expect(blocked).toBe(false);
    },
  );

  it("threshold constant stays in a sane band", () => {
    expect(SEMANTIC_GUARD_THRESHOLD).toBeGreaterThan(0.5);
    expect(SEMANTIC_GUARD_THRESHOLD).toBeLessThanOrEqual(0.95);
  });
});
