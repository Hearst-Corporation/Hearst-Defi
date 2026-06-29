import { describe, expect, it } from "vitest";

import { runOutreachDiagnostics } from "@/lib/admin/diagnostics/outreach-diagnostics";

describe("outreach diagnostics (real guard + policy functions)", () => {
  const noDeps = runOutreachDiagnostics();

  it("has zero failing checks", () => {
    const fails = noDeps.filter((r) => r.status === "fail");
    expect(JSON.stringify(fails, null, 2)).toBe("[]");
  });

  it.each([
    "outreach.direct-forbidden-blocked",
    "outreach.tier-a-never-autosend",
    "outreach.suggest-zero-autosend",
    "outreach.send-allows-bc-firsttouch",
    "outreach.followup-needs-nurture",
    "outreach.warmup-day0-floor",
    "outreach.assert-throws",
    "outreach.clean-passes",
  ])("%s passes against the real policy/guard", (id) => {
    expect(noDeps.find((r) => r.id === id)?.status).toBe("pass");
  });

  it("SKIPS the suppression probe without injected deps", () => {
    expect(noDeps.find((r) => r.id === "outreach.suppression-blocks")?.status).toBe(
      "skipped",
    );
  });

  it("PASSES the suppression probe when the route injects a real result", () => {
    const withDeps = runOutreachDiagnostics({
      suppressionProbe: { email: "probe@hearst.invalid", suppressed: false },
    });
    expect(withDeps.find((r) => r.id === "outreach.suppression-blocks")?.status).toBe(
      "pass",
    );
  });
});
