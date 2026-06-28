/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/bento-badge`.
 *
 * The canonical Hearst status chip now lives in Catalyst as `BentoBadge`; this
 * module re-exports it under the historical `Badge` / `BadgeVariant` names so the
 * ~28 existing `@/components/ui/badge` call sites keep working unchanged during
 * the Catalyst absorption migration (MISSION #043). No autonomous visual
 * component lives here anymore.
 */

export {
  BentoBadge as Badge,
  type BentoBadgeVariant as BadgeVariant,
} from "@/components/catalyst/bento-badge";
