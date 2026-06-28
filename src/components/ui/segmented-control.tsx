/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/segmented-control`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/segmented-control` call sites keep working
 * unchanged during the Catalyst absorption migration. No autonomous visual
 * component lives here anymore.
 */

export { SegmentedControl } from "@/components/catalyst/segmented-control";
export type { SegmentedItem } from "@/components/catalyst/segmented-control";
