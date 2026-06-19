import type { Provenance } from "@/components/ui/provenance-badge";

/**
 * Portfolio view-state contract — typed zero/live discriminant for cockpit widgets.
 *
 * Hero widgets resolve {mode, provenance} once in `portfolio-view.ts` (Architecture A).
 * Mid/trio widgets call `resolveWidgetView` locally until Phase 3 centralises them.
 * See docs/PORTFOLIO_ZERO_CONTRACT.md.
 *
 * Pure module (no server-only, no I/O) — unit-testable in isolation.
 */

export type PortfolioViewState =
  | { kind: "preview" }
  | { kind: "live" };

/** Per-widget resolved mode: `zero` renders the honest empty/placeholder shell. */
export type WidgetMode = "zero" | "live";

export interface WidgetView {
  mode: WidgetMode;
  /** Badge shown ONLY in live mode with real data — never fabricated in zero. */
  provenance: Provenance | undefined;
}

/**
 * Resolve a widget's mode + provenance once.
 *
 * Rules (preserve the existing honesty invariants verbatim):
 *  - `previewZeros` (zero-position investor) forces `zero` for every widget.
 *  - On a live investor, a widget whose OWN data is empty is still `zero`
 *    (honest empty surface — not fabricated data).
 *  - A provenance badge appears only in `live` mode; `zero` never shows one.
 */
export function resolveWidgetView(input: {
  previewZeros: boolean;
  hasData: boolean;
  provenance: Provenance | undefined;
}): WidgetView {
  const mode: WidgetMode =
    input.previewZeros || !input.hasData ? "zero" : "live";
  return { mode, provenance: mode === "zero" ? undefined : input.provenance };
}

/** Page-level state from the single `previewZeros` discriminant. */
export function resolvePortfolioViewState(previewZeros: boolean): PortfolioViewState {
  return previewZeros ? { kind: "preview" } : { kind: "live" };
}
