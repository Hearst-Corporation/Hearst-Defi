/**
 * COMPAT FAÇADE — single-DS convergence.
 *
 * The real implementation now lives in
 * `@/components/catalyst/chart-provenance-corner`. This thin file re-exports
 * it so existing `@/components/ui/chart-provenance-corner` importers keep
 * working unchanged. Edit the Catalyst source, not this façade.
 */
export { ChartProvenanceCorner } from "@/components/catalyst/chart-provenance-corner";
export type { ProvenanceKind } from "@/components/catalyst/chart-provenance-corner";
export type { ChartProvenanceCornerProps } from "@/components/catalyst/chart-provenance-corner";
