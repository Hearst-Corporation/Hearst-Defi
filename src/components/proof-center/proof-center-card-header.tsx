import type { ComponentProps } from "react";

import { DashboardPanelHeader } from "@/components/catalyst/dashboard-panel-header";

import type { ProofCenterSectionLedProps } from "./proof-center-types";

type DashboardPanelHeaderProps = ComponentProps<typeof DashboardPanelHeader>;

/**
 * Proof Center card header — when `sectionLed`, the visible page `<h2>` owns the
 * section title; the card shows an h3 subtitle + provenance only.
 */
export function ProofCenterCardHeader({
  sectionLed = false,
  eyebrow,
  titleLevel,
  ...props
}: DashboardPanelHeaderProps & ProofCenterSectionLedProps) {
  return (
    <DashboardPanelHeader
      {...props}
      eyebrow={sectionLed ? undefined : eyebrow}
      titleLevel={sectionLed ? "widget" : titleLevel}
    />
  );
}
