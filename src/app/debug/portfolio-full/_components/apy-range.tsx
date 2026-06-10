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
        "tabular font-semibold ct-text-strong inline-flex items-baseline",
        className,
      )}
      aria-label={`APY range ${fmt(a)} to ${fmt(b)} ${suffix}`}
    >
      {fmt(a)}
      <span
        aria-hidden
        className="mx-1 ct-text-muted font-normal text-[0.85em] leading-none translate-y-[-0.06em]"
      >
        —
      </span>
      {fmt(b)}
      <span aria-hidden className="ml-1 text-micro font-medium opacity-80">
        {suffix}
      </span>
    </span>
  );
}
