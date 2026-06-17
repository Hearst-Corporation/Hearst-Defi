/**
 * Unit tests for parseAuditDiff — pure function, no DB dependency.
 *
 * Covers:
 *  1. Valid JSON with both keys → returns {before, after}
 *  2. Valid JSON with only one key → missing key defaults to null
 *  3. Valid JSON with no relevant keys → both default to null
 *  4. Malformed JSON → fail-safe returns {before:null, after:null}
 *  5. Empty string → fail-safe returns {before:null, after:null}
 *  6. Non-object JSON (string/number/array) → both default to null
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {},
}));

// parseAuditDiff is a pure helper — mock db so server-only audit module loads in vitest.
import { parseAuditDiff } from "../audit";

describe("parseAuditDiff", () => {
  it("valid JSON with both before and after → returns them as-is", () => {
    const before = { status: "draft", amount: 1000 };
    const after = { status: "approved", amount: 1000 };
    const diff = JSON.stringify({ before, after });

    const result = parseAuditDiff(diff);

    expect(result.before).toEqual(before);
    expect(result.after).toEqual(after);
  });

  it("valid JSON with only before → after defaults to null", () => {
    const before = { status: "pending" };
    const diff = JSON.stringify({ before });

    const result = parseAuditDiff(diff);

    expect(result.before).toEqual(before);
    expect(result.after).toBeNull();
  });

  it("valid JSON with only after → before defaults to null", () => {
    const after = { status: "distributed" };
    const diff = JSON.stringify({ after });

    const result = parseAuditDiff(diff);

    expect(result.before).toBeNull();
    expect(result.after).toEqual(after);
  });

  it("valid JSON with no before/after keys → both default to null", () => {
    const diff = JSON.stringify({ unrelated: "data" });

    const result = parseAuditDiff(diff);

    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("malformed JSON → fail-safe {before:null, after:null}", () => {
    const result = parseAuditDiff("{not valid json");

    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("empty string → fail-safe {before:null, after:null}", () => {
    const result = parseAuditDiff("");

    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("JSON array (non-object) → both default to null", () => {
    const diff = JSON.stringify([1, 2, 3]);

    const result = parseAuditDiff(diff);

    // Arrays don't have .before / .after properties; nullish coalescing
    // inside the helper returns null for both.
    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("JSON primitive string → fail-safe {before:null, after:null}", () => {
    const diff = JSON.stringify("just a string");

    const result = parseAuditDiff(diff);

    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("before/after are null explicitly → returned as null, not undefined", () => {
    const diff = JSON.stringify({ before: null, after: null });

    const result = parseAuditDiff(diff);

    expect(result.before).toBeNull();
    expect(result.after).toBeNull();
  });

  it("nested objects are returned intact", () => {
    const before = { vault: { id: "v1", allocation: [0.4, 0.6] } };
    const after = { vault: { id: "v1", allocation: [0.5, 0.5] } };
    const diff = JSON.stringify({ before, after });

    const result = parseAuditDiff(diff);

    expect(result.before).toEqual(before);
    expect(result.after).toEqual(after);
  });
});
