"use client";

import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";

/** Triggers the browser print dialog (→ Save as PDF). Hidden when printing. */
export function PrintButton() {
  return (
    <Button variant="primary" size="sm" onClick={() => window.print()}>
      Print / Save as PDF
    </Button>
  );
}
