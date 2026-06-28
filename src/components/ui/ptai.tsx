/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/ptai`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/ptai` call sites keep working unchanged
 * during the Catalyst absorption migration. No autonomous visual component lives
 * here anymore.
 */

export { Ptai } from "@/components/catalyst/ptai";
