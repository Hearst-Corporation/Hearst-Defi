import type { Provenance } from "@/components/ui/provenance-badge";

/**
 * Portfolio widget view resolver.
 *
 * `resolveWidgetView` is used by ProofPulse to decide whether to show a
 * provenance badge. `previewZeros` is always `false` post-demo-removal —
 * kept in the signature for backward compatibility with any remaining callers
 * that may not have been updated yet.
 *
 * Pure module (no server-only, no I/O) — unit-testable in isolation.
 */

/** Per-widget resolved mode. */
export type WidgetMode = "zero" | "live";

export interface WidgetView {
  mode: WidgetMode;
  /** Badge shown ONLY in live mode with real data — never fabricated in zero. */
  provenance: Provenance | undefined;
}

/**
 * Resolve a widget's mode + provenance once.
 *
 * `previewZeros` is always `false` after demo-layer removal.
 * A widget whose own data is empty resolves to `zero` (honest empty surface).
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
