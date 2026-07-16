// BitcoinOrbit — product identity mark: ₿ symbol + progress ring + subtle halo.
// Server-safe: motion is CSS-only (investor-widgets.css).

import { cn } from "@/lib/cn";

interface BitcoinOrbitProps {
  /** Product term progress 0–100 (e.g. month 9 of 24 → 37.5). */
  progressPct: number;
  /** Enable subtle pulse when new data arrived (fixture/live signal). */
  pulse?: boolean;
  className?: string;
}

export function BitcoinOrbit({ progressPct, pulse = false, className }: BitcoinOrbitProps) {
  const clamped = Math.min(100, Math.max(0, progressPct));

  return (
    <div
      className={cn("iw-btc-orbit", pulse && "iw-btc-orbit--pulse", className)}
      style={{ "--iw-progress": String(clamped) } as React.CSSProperties}
      aria-hidden
    >
      <div className="iw-btc-orbit__halo" />
      <div className="iw-btc-orbit__ring" />
      <div className="iw-btc-orbit__progress" />
      <span className="iw-btc-orbit__symbol">₿</span>
    </div>
  );
}
