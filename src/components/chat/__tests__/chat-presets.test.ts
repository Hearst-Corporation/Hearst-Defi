/**
 * Unit tests — ChatPresets admin-probe route gate.
 *
 * The admin chip set only matters on admin surfaces, so the
 * GET /api/admin/review-mode probe must run ONLY when the current route is under
 * `/admin`. On the LP cockpit (`/portfolio`, `/vaults`, …) the component defaults
 * to the LP set with zero network — this is the perf invariant the guardrail
 * (`pnpm qa:perf-network`) enforces end-to-end (review-mode == 0 on /portfolio).
 *
 * Vitest runs in a `node` environment (no jsdom), so we test the exported pure
 * gate rather than rendering the effect — same pattern as chat-nav-bridge.
 */

import { describe, expect, it } from "vitest";

import { shouldProbeAdminRole } from "../chat-presets";

describe("shouldProbeAdminRole (review-mode probe route gate)", () => {
  it("does NOT probe on the LP cockpit (zero review-mode network)", () => {
    expect(shouldProbeAdminRole("/portfolio")).toBe(false);
    expect(shouldProbeAdminRole("/portfolio/yield")).toBe(false);
    expect(shouldProbeAdminRole("/vaults")).toBe(false);
    expect(shouldProbeAdminRole("/proof-center")).toBe(false);
    expect(shouldProbeAdminRole("/profile")).toBe(false);
  });

  it("probes on admin surfaces", () => {
    expect(shouldProbeAdminRole("/admin")).toBe(true);
    expect(shouldProbeAdminRole("/admin/agentic")).toBe(true);
    expect(shouldProbeAdminRole("/admin/review")).toBe(true);
  });

  it("fails closed (no probe) when the pathname is unknown", () => {
    expect(shouldProbeAdminRole(null)).toBe(false);
    expect(shouldProbeAdminRole(undefined)).toBe(false);
    expect(shouldProbeAdminRole("")).toBe(false);
  });

  it("does not treat an `/administration`-style prefix collision specially", () => {
    // `startsWith("/admin")` matches `/administration` too — acceptable: there is
    // no such LP route, and the probe just fails closed to LP if not an admin.
    expect(shouldProbeAdminRole("/administration")).toBe(true);
  });
});
