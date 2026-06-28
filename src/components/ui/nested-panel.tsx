/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/nested-panel`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/nested-panel` call sites keep working
 * unchanged during the Catalyst absorption migration. No autonomous visual
 * component lives here anymore.
 */

export {
  NestedPanel,
  DataRow,
  LegalMetadataRow,
  ProofRow,
  MetricGrid,
} from "@/components/catalyst/nested-panel";
