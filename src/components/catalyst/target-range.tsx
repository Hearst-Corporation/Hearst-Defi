// Catalyst TargetRange — canonical, token-only range display (low–high %).
// Renamed from ApyRange (D8 vocabulary purge): Series 1 communicates a target
// ACCUMULATION range (BTC accumulated over the term), never an APY/yield rate.
// apy-range.tsx remains as a deprecated 1-line re-export until its last legacy
// importer (E6 scope) is removed by the integrator.
import { cn } from "@/lib/cn";

interface TargetRangeProps {
  low: number;
  high: number;
  precision?: 0 | 1 | 2;
  suffix?: string;
  className?: string;
}

export function TargetRange({
  low,
  high,
  precision = 1,
  suffix = "%",
  className,
}: TargetRangeProps) {
  const [a, b] = low <= high ? [low, high] : [high, low];
  const fmt = (n: number) => n.toFixed(precision);
  return (
    <span
      className={cn(
        "tabular inline-flex items-baseline",
        className ?? "font-semibold ct-text-strong",
      )}
      aria-label={`Target accumulation range ${fmt(a)} to ${fmt(b)} ${suffix}`}
    >
      {fmt(a)}
      <span
        aria-hidden
        className="mx-[var(--ct-space-1)] ct-text-muted font-normal body-xs leading-tight"
      >
        {/* Canonical en-dash separator for ranges (non-negotiable #1),
            matching APY_RANGE_SEP in src/lib/format/apy.ts. */}
        {"–"}
      </span>
      {fmt(b)}
      <span aria-hidden className="ml-[var(--ct-space-1)] body-xs opacity-[var(--ct-opacity-80)]">
        {suffix}
      </span>
    </span>
  );
}
