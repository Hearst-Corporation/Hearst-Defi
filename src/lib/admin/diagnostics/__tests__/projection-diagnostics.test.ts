import { describe, expect, it } from "vitest";

import { runProjectionDiagnostics } from "@/lib/admin/diagnostics/projection-diagnostics";

describe("projection diagnostics (real pure preset)", () => {
  const results = runProjectionDiagnostics();

  it("has zero failing checks", () => {
    const fails = results.filter((r) => r.status === "fail");
    expect(JSON.stringify(fails, null, 2)).toBe("[]");
  });

  it.each([
    "proj.preset-structural-only",
    "proj.no-numeric-prefill",
    "proj.opaque-no-safe-fields",
    "proj.review-forbidden-lists",
    "proj.methodology-version",
  ])("%s passes against the real preset", (id) => {
    expect(results.find((r) => r.id === id)?.status).toBe("pass");
  });

  it("honestly SKIPS DB-write / private-schema checks", () => {
    const skipped = results.filter((r) => r.status === "skipped").map((r) => r.id);
    expect(skipped).toContain("proj.get-creates-no-run");
    expect(skipped).toContain("proj.run-is-db-write");
    expect(skipped).toContain("proj.run-schema-requires-assumptions");
  });
});
