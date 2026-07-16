"use client";

// Client-only CTA for AnalystNotePanel — opens the existing chat rail via
// the shell's own public setter (`forceOpenRailRight`, re-exported from
// `@hearst/cockpit-shell`'s railOpenStore, the same store `ChatRailToggle`
// drives). Previously the CTA linked to `?chat=open`, a query param no
// route/layout ever consumed (dead link — grep confirmed zero readers).
// Kept as its own file so the panel itself stays a Server Component; only
// this button crosses the client boundary. No change to cockpit-shell/.

import { forceOpenRailRight } from "@hearst/cockpit-shell";
import { CockpitButton, type CockpitButtonProps } from "@/components/catalyst/cockpit-button";

export function AskStrategistButton({
  onClick,
  ...rest
}: Omit<CockpitButtonProps, "href" | "asChild">) {
  return (
    <CockpitButton
      type="button"
      onClick={(e) => {
        forceOpenRailRight();
        onClick?.(e);
      }}
      {...rest}
    />
  );
}
