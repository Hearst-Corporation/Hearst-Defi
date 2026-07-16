import { describe, it, expect } from "vitest";

import { safeFrom } from "@/lib/safe-redirect";

describe("safeFrom", () => {
  describe("rejects with fallback", () => {
    it.each([
      ["null", null],
      ["undefined", undefined],
      ["empty string", ""],
      ["absolute https URL", "https://evil.com"],
      ["protocol-relative //", "//evil.com"],
      ["protocol-relative //path", "//evil.com/path"],
      ["backslash bypass /\\evil.com", "/\\evil.com"],
      ["backslash anywhere /path/\\evil", "/path/\\evil"],
      ["javascript: pseudo-URL", "javascript:alert(1)"],
      ["leading whitespace", "  /dashboard"],
      ["newline control char", "/dashboard\n"],
      ["null byte", "/dashboard\x00"],
    ])("returns fallback for %s", (_label, input) => {
      expect(safeFrom(input)).toBe("/dashboard");
    });

    it("uses custom fallback when provided", () => {
      expect(safeFrom(null, "/my-vaults")).toBe("/my-vaults");
      expect(safeFrom("//evil.com", "/home")).toBe("/home");
    });
  });

  describe("accepts valid relative paths", () => {
    it.each([
      ["/dashboard"],
      ["/dashboard/x"],
      ["/admin/vaults/abc?tab=2"],
      ["/portfolio/123#section"],
      ["/"],
      ["/path-with-dashes_and.dots"],
    ])("preserves %s", (input) => {
      expect(safeFrom(input)).toBe(input);
    });
  });
});
