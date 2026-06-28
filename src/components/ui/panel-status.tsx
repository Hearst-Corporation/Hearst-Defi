/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/panel-status`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the existing `@/components/ui/panel-status` call sites keep working
 * unchanged during the Catalyst absorption migration. No autonomous visual
 * component lives here anymore.
 */

export {
  PanelStatus,
  PanelStatusAccent,
  PanelStatusSection,
  type PanelStatusProps,
  type PanelStatusTone,
} from "@/components/catalyst/panel-status";
