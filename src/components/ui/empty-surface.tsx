/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/empty-surface`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/empty-surface` call sites keep working
 * unchanged during the Catalyst absorption migration (MISSION #043). No
 * autonomous visual component lives here anymore.
 */

export {
  EmptySurface,
  type EmptySurfaceProps,
  type EmptySurfaceVariant,
} from "@/components/catalyst/empty-surface";
