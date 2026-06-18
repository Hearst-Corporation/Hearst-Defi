import { describe, it, expect } from "vitest";

import {
  resolveWidgetView,
  resolvePortfolioViewState,
} from "@/lib/portfolio/view-state";

describe("resolvePortfolioViewState", () => {
  it("previewZeros → preview kind", () => {
    expect(resolvePortfolioViewState(true)).toEqual({ kind: "preview" });
  });
  it("!previewZeros → live kind", () => {
    expect(resolvePortfolioViewState(false)).toEqual({ kind: "live" });
  });
});

describe("resolveWidgetView", () => {
  it("previewZeros forces zero + drops provenance (no fabricated badge)", () => {
    expect(
      resolveWidgetView({ previewZeros: true, hasData: true, provenance: "live" }),
    ).toEqual({ mode: "zero", provenance: undefined });
  });

  it("live investor + empty widget data → zero (honest empty), no badge", () => {
    expect(
      resolveWidgetView({ previewZeros: false, hasData: false, provenance: "live" }),
    ).toEqual({ mode: "zero", provenance: undefined });
  });

  it("live investor + real data → live + keeps provenance", () => {
    expect(
      resolveWidgetView({ previewZeros: false, hasData: true, provenance: "attested" }),
    ).toEqual({ mode: "live", provenance: "attested" });
  });

  it("live with data but undefined provenance stays live with no badge", () => {
    expect(
      resolveWidgetView({ previewZeros: false, hasData: true, provenance: undefined }),
    ).toEqual({ mode: "live", provenance: undefined });
  });
});
