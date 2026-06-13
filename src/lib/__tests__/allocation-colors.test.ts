import { describe, expect, it } from "vitest";

import {
  ALLOCATION_DASH_TONE,
  ALLOCATION_STROKE,
  allocationDashToneFor,
  allocationStrokeFor,
} from "@/lib/allocation-colors";

describe("allocation-colors", () => {
  it("maps engine buckets to dashboard bento strokes", () => {
    expect(ALLOCATION_STROKE.mining).toBe("var(--ct-status-success)");
    expect(ALLOCATION_STROKE.btc_tactical).toBe("var(--ct-status-warning)");
    expect(ALLOCATION_STROKE.usdc_base).toBe("var(--ct-status-info)");
    expect(ALLOCATION_STROKE.stable_reserve).toBe("var(--ct-text-faint)");
  });

  it("maps hyphen mock ids to the same strokes", () => {
    expect(allocationStrokeFor("btc-tactical")).toBe(ALLOCATION_STROKE.btc_tactical);
    expect(allocationStrokeFor("usdc-base")).toBe(ALLOCATION_STROKE.usdc_base);
    expect(allocationDashToneFor("stable-reserve")).toBe("faint");
  });

  it("keeps dash tone classes aligned with strokes", () => {
    expect(ALLOCATION_DASH_TONE.mining).toBe("success");
    expect(ALLOCATION_DASH_TONE.btc_tactical).toBe("muted");
  });
});
