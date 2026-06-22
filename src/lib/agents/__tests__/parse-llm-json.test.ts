import { describe, expect, it } from "vitest";

import {
  extractLlmJsonCandidate,
  parseLlmJsonObject,
  tryParseLlmJsonObject,
} from "@/lib/agents/parse-llm-json";

describe("parse-llm-json", () => {
  it("parses bare JSON objects", () => {
    expect(parseLlmJsonObject('{"a":1}', "Test")).toEqual({ a: 1 });
  });

  it("strips ```json fences", () => {
    const raw = '```json\n{"score": 72}\n```';
    expect(parseLlmJsonObject(raw, "Scorer")).toEqual({ score: 72 });
  });

  it("slices prose around a JSON object", () => {
    const raw = 'Here is the result: {"intent":"interested"} — thanks.';
    expect(extractLlmJsonCandidate(raw)).toBe('{"intent":"interested"}');
  });

  it("throws with context on invalid JSON", () => {
    expect(() => parseLlmJsonObject("not json", "Writer")).toThrow(
      /Writer returned invalid JSON/,
    );
  });

  it("tryParseLlmJsonObject returns null on failure", () => {
    expect(tryParseLlmJsonObject("not json")).toBeNull();
  });
});
