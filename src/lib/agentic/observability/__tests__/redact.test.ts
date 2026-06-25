import { describe, expect, it } from "vitest";

import { redactSnippet, MAX_SNIPPET_LEN } from "@/lib/agentic/observability/redact";

describe("redactSnippet (defence-in-depth helper, unused on hot path)", () => {
  it("returns undefined for empty / nullish input", () => {
    expect(redactSnippet(undefined)).toBeUndefined();
    expect(redactSnippet(null)).toBeUndefined();
    expect(redactSnippet("   ")).toBeUndefined();
  });

  it("collapses whitespace + control chars", () => {
    expect(redactSnippet("a\t\n  b")).toBe("a b");
  });

  it("caps to MAX_SNIPPET_LEN with an ellipsis", () => {
    const long = "x".repeat(200);
    const out = redactSnippet(long) ?? "";
    expect(out.length).toBeLessThanOrEqual(MAX_SNIPPET_LEN);
    expect(out.endsWith("…")).toBe(true);
  });

  it("scrubs sk- keys, emails, and bearer/secret patterns", () => {
    expect(redactSnippet("key sk-ABCDEFGH1234 here")).toContain("[redacted]");
    expect(redactSnippet("mail john@doe.com")).toContain("[email]");
    expect(redactSnippet("Bearer abc.def.ghi")).toContain("[redacted]");
  });
});
