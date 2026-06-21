import { cn } from "@/lib/cn";

interface ApyRangeProps {
  low: number;
  high: number;
  precision?: 0 | 1 | 2;
  suffix?: string;
  className?: string;
}

export function ApyRange({
  low,
  high,
  precision = 1,
  suffix = "%",
  className,
}: ApyRangeProps) {
  const [a, b] = low <= high ? [low, high] : [high, low];
  const fmt = (n: number) => n.toFixed(precision);
  return (
    <span
      className={cn(
        "tabular inline-flex items-baseline",
        className ?? "font-semibold ct-text-strong",
      )}
      aria-label={`APY range ${fmt(a)} to ${fmt(b)} ${suffix}`}
    >
      {fmt(a)}
      <span
        aria-hidden
        className="mx-[var(--ct-space-1)] ct-text-muted font-normal body-xs leading-tight"
      >
        —
      </span>
      {fmt(b)}
      <span aria-hidden className="ml-[var(--ct-space-1)] body-xs opacity-[var(--ct-opacity-80)]">
        {suffix}
      </span>
    </span>
  );
}
