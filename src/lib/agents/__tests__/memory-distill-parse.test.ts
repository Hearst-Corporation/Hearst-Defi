import { describe, it, expect } from "vitest";

import { tryParseLlmJsonObject } from "@/lib/agents/parse-llm-json";

/**
 * Unit pin for the PURE fact-parsing logic of `memory-distill.ts`.
 *
 * `parseFacts` in `src/lib/agents/memory-distill.ts` is not exported and the
 * module pulls in `server-only` + prisma (`@/lib/db`) at import time, so it
 * cannot be imported into a plain Vitest unit without dragging the DB layer in.
 * Per the task constraints we neither modify the source nor mock the OpenAI /
 * Prisma layer: instead we drive the SAME pure building blocks the parser is
 * composed of — `tryParseLlmJsonObject` (the exact exported helper
 * `parseFacts` calls) plus a faithful, dependency-free re-implementation of the
 * post-parse normalisation rules (facts[] unwrap, kind allow-list fallback,
 * min-length filter, ≤ MAX_FACT_LEN truncation).
 *
 * The re-implementation below mirrors `parseFacts` line-for-line; the source of
 * truth for the constants is duplicated here (not imported) because
 * `@/lib/agents/memory` is likewise `server-only`. Keeping the two in sync is
 * cheap and the fixtures assert the observable contract: LLM text → parsed
 * facts, including the empty / malformed / truncation edge cases.
 */

// Mirrors `MEMORY_KINDS` in `src/lib/agents/memory.ts`.
const MEMORY_KINDS: ReadonlySet<string> = new Set([
  "fact",
  "preference",
  "goal",
  "constraint",
]);
type MemoryKind = "fact" | "preference" | "goal" | "constraint";

// Mirrors `MAX_FACT_LEN` in `src/lib/agents/memory.ts`.
const MAX_FACT_LEN = 280;

// Mirrors the private `MAX_FACTS` cap in `memory-distill.ts`.
const MAX_FACTS = 8;

interface MemoryFactInput {
  content: string;
  kind?: MemoryKind;
}

interface DistilledFact {
  kind?: string;
  content?: unknown;
}

/**
 * Faithful port of the unexported `parseFacts` from `memory-distill.ts`. Drives
 * the real `tryParseLlmJsonObject`; the rest is pure array/string handling.
 */
function parseFacts(raw: string): MemoryFactInput[] {
  const parsed = tryParseLlmJsonObject(raw);
  if (parsed === null) return [];

  const arr =
    parsed && typeof parsed === "object" && "facts" in parsed
      ? (parsed as { facts: unknown }).facts
      : parsed;

  if (!Array.isArray(arr)) return [];

  const out: MemoryFactInput[] = [];
  for (const item of arr.slice(0, MAX_FACTS)) {
    if (item === null || typeof item !== "object") continue;
    const { kind, content } = item as DistilledFact;
    if (typeof content !== "string") continue;
    const trimmed = content.trim();
    if (trimmed.length < 3) continue;
    const safeKind: MemoryKind = MEMORY_KINDS.has(String(kind))
      ? (kind as MemoryKind)
      : "fact";
    out.push({ kind: safeKind, content: trimmed.slice(0, MAX_FACT_LEN) });
  }
  return out;
}

describe("memory-distill parseFacts (pure fact parser)", () => {
  it("parses a well-formed {facts:[...]} distillation payload", () => {
    const raw = JSON.stringify({
      facts: [
        { kind: "preference", content: "Prefers BTC accumulated at maturity rather than cash distribution." },
        { kind: "goal", content: "Targets an 8-15% estimated return range (BTC accumulated)." },
        { kind: "constraint", content: "Can only allocate via a Cayman SPV." },
      ],
    });

    const facts = parseFacts(raw);

    expect(facts).toHaveLength(3);
    expect(facts[0]).toEqual({
      kind: "preference",
      content: "Prefers BTC accumulated at maturity rather than cash distribution.",
    });
    expect(facts.map((f) => f.kind)).toEqual([
      "preference",
      "goal",
      "constraint",
    ]);
  });

  it("strips markdown fences before parsing (delegates to tryParseLlmJsonObject)", () => {
    const raw =
      "```json\n" +
      JSON.stringify({ facts: [{ kind: "fact", content: "Min ticket is $250k." }] }) +
      "\n```";

    const facts = parseFacts(raw);

    expect(facts).toEqual([{ kind: "fact", content: "Min ticket is $250k." }]);
  });

  it("returns [] on an empty string", () => {
    expect(parseFacts("")).toEqual([]);
  });

  it("returns [] on the model's explicit empty-facts answer", () => {
    expect(parseFacts(JSON.stringify({ facts: [] }))).toEqual([]);
  });

  it("returns [] on malformed / non-JSON text (never throws)", () => {
    expect(parseFacts("not json at all")).toEqual([]);
    expect(parseFacts('{"facts": [broken')).toEqual([]);
    expect(parseFacts("{")).toEqual([]);
  });

  it("returns [] when the payload is a JSON object without a facts array", () => {
    expect(parseFacts(JSON.stringify({ notes: "hello" }))).toEqual([]);
    expect(parseFacts(JSON.stringify({ facts: "oops" }))).toEqual([]);
  });

  it("returns [] for a top-level JSON array (candidate extraction slices to {…} only)", () => {
    // `tryParseLlmJsonObject` → `extractLlmJsonCandidate` looks for the outer
    // `{…}` object; a bare top-level array does not survive extraction, so the
    // `Array.isArray` branch never fires and parseFacts yields [].
    const raw = JSON.stringify([
      { kind: "fact", content: "Jurisdiction is Singapore." },
    ]);
    expect(parseFacts(raw)).toEqual([]);
  });

  it("truncates each fact content to MAX_FACT_LEN (280) characters", () => {
    const long = "x".repeat(400);
    const raw = JSON.stringify({ facts: [{ kind: "fact", content: long }] });

    const facts = parseFacts(raw);

    expect(facts).toHaveLength(1);
    expect(facts[0]?.content).toHaveLength(MAX_FACT_LEN);
    expect(facts[0]?.content).toBe("x".repeat(MAX_FACT_LEN));
  });

  it("keeps a fact whose content is exactly at the truncation bound untouched", () => {
    const exact = "y".repeat(MAX_FACT_LEN);
    const raw = JSON.stringify({ facts: [{ kind: "fact", content: exact }] });

    const facts = parseFacts(raw);

    expect(facts[0]?.content).toBe(exact);
  });

  it("trims whitespace and drops facts shorter than 3 chars after trim", () => {
    const raw = JSON.stringify({
      facts: [
        { kind: "fact", content: "  Keeps this one.  " },
        { kind: "fact", content: "  a  " }, // trims to "a" → dropped (<3)
        { kind: "fact", content: "   " }, // trims to "" → dropped
      ],
    });

    const facts = parseFacts(raw);

    expect(facts).toEqual([{ kind: "fact", content: "Keeps this one." }]);
  });

  it("falls back to 'fact' for an unknown or missing kind", () => {
    const raw = JSON.stringify({
      facts: [
        { kind: "banana", content: "Unknown kind coerces to fact." },
        { content: "Missing kind coerces to fact." },
        { kind: 123, content: "Numeric kind coerces to fact." },
      ],
    });

    const facts = parseFacts(raw);

    expect(facts).toHaveLength(3);
    expect(facts.every((f) => f.kind === "fact")).toBe(true);
  });

  it("skips items whose content is not a string, and null/non-object items", () => {
    const raw = JSON.stringify({
      facts: [
        null,
        "a bare string",
        42,
        { kind: "fact", content: 999 },
        { kind: "fact" }, // no content
        { kind: "goal", content: "The only survivor." },
      ],
    });

    const facts = parseFacts(raw);

    expect(facts).toEqual([{ kind: "goal", content: "The only survivor." }]);
  });

  it("caps the parsed list at MAX_FACTS (8), ignoring the overflow", () => {
    const facts = Array.from({ length: 20 }, (_, i) => ({
      kind: "fact",
      content: `Fact number ${i}.`,
    }));
    const raw = JSON.stringify({ facts });

    const parsed = parseFacts(raw);

    expect(parsed).toHaveLength(MAX_FACTS);
    expect(parsed[0]?.content).toBe("Fact number 0.");
    expect(parsed[MAX_FACTS - 1]?.content).toBe("Fact number 7.");
  });
});
