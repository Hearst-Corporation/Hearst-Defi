/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/tooltip`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/tooltip` call sites keep working unchanged
 * during the Catalyst absorption migration. No autonomous visual component lives
 * here anymore.
 */

export { Tooltip } from "@/components/catalyst/tooltip";
