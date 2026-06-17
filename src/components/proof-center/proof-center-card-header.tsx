import {
  DashboardPanelHeader,
  type DashboardPanelHeaderProps,
} from "@/components/ui/dashboard-panel-header";

/**
 * Proof Center card header — when `sectionLed`, the visible page `<h2>` owns the
 * section title; the card shows an h3 subtitle + provenance only.
 */
export function ProofCenterCardHeader({
  sectionLed = false,
  eyebrow,
  titleLevel,
  ...props
}: DashboardPanelHeaderProps & { sectionLed?: boolean }) {
  return (
    <DashboardPanelHeader
      {...props}
      eyebrow={sectionLed ? undefined : eyebrow}
      titleLevel={sectionLed ? "widget" : titleLevel}
    />
  );
}
