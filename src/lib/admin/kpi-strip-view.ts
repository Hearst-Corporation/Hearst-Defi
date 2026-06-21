// =============================================================================
// KPI strip — presentation VIEW-MODEL (UI-presenter layer).
//
// Boundary note (data ↔ UI):
//   This type is a PRESENTATION view-model, not a data DTO. It is produced by
//   the `build*KpiStrip()` presenters in this folder (src/lib/admin/*), which
//   translate already-loaded business data into a strip the cockpit UI renders.
//   It deliberately lives HERE (presenter layer) and NOT in src/lib/data/* —
//   the `server-only` data loaders never emit it.
//
//   The fields are semantic, not chrome:
//     - `provenance`  → business provenance (non-negotiable #2), the UI maps it
//                       to a badge/dot.
//     - `alert` / `accent` → semantic INTENT flags (degraded vs positive-attention),
//                       the UI maps them to danger/accent color. They carry no
//                       className, color value, or layout — the visual decision
//                       stays in the component.
// =============================================================================

/** Provenance badge kinds — see non-negotiable #2 (Live / Oracle / Attested …). */
export type HeroKpiProvenance =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "partial"
  | "manual"
  | "stale"
  | "simulated";

/** One cell of a cockpit KPI strip. Presentation view-model (see file header). */
export interface HeroKpi {
  label: string;
  value: string;
  sublabel: string;
  provenance: HeroKpiProvenance;
  /** Semantic intent: value represents an alert / degraded state (UI → danger). */
  alert?: boolean;
  /** Semantic intent: positive-attention highlight that is NOT degraded
   *  (e.g. an action queue needing attention) — UI maps to the brand accent. */
  accent?: boolean;
}
