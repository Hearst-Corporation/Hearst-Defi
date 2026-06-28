/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/cockpit-button`.
 *
 * The canonical Hearst cockpit button now lives in Catalyst as `CockpitButton`;
 * this module re-exports it under the historical `Button` name so the ~37
 * existing `@/components/ui/button` call sites keep working unchanged during the
 * Catalyst absorption migration (MISSION #043). No autonomous visual component
 * lives here anymore.
 */

export {
  CockpitButton as Button,
  cockpitButtonVariants as buttonVariants,
} from "@/components/catalyst/cockpit-button";
