// design-sync preview frame (cfg.provider). The preview/DS-pane card HTML hardcodes
// a white body background, but Hearst Connect is a DARK design system — light-on-dark
// components (white metric values, muted text) would be invisible on white. This frame
// wraps every preview cell in the DS's own deep background + base text color + Satoshi,
// mirroring how the real app body renders. Internal (double-underscore) — not a card.
import * as React from "react";

export function __DsFrame({ children }: { children?: React.ReactNode }) {
  return (
    <div
      style={{
        margin: "-24px", // cancel the card HTML's body padding so the dark surface bleeds to the edges
        padding: "28px",
        background: "var(--ct-bg-deep, #0E0F0F)",
        color: "var(--ct-text-body, rgba(245,245,245,0.72))",
        fontFamily: 'var(--font-sans, "Satoshi Variable", sans-serif)',
        minHeight: "112px",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
