import { cn } from "@/lib/cn";

interface ProgressProps {
  value: number;
  max?: number;
  /** `plain` — no shimmer, inset shadow, or backdrop blur (dense admin lists). */
  variant?: "default" | "plain";
  /** Optional class applied to the fill bar (e.g. "bg-[var(--ct-status-danger)]"). */
  fillClassName?: string;
  className?: string;
  /**
   * Accessible name for the progressbar. Screen readers announce
   * "<label>, X percent" instead of just the bare value. Pass the dimension
   * (e.g. "Liquidity risk score") so the value lands with context.
   */
  label?: string;
  /** Reference an existing visible label via id (alternative to `label`). */
  labelledBy?: string;
}

export function Progress({
  value,
  max = 100,
  variant = "default",
  fillClassName,
  className,
  label,
  labelledBy,
}: ProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const isPlain = variant === "plain";
  return (
    <div
      className={cn(
        "h-1.5 w-full overflow-hidden rounded-full ct-surface-2",
        !isPlain && "shadow-[var(--ct-shadow-inset)]",
        className,
      )}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      <div
        className={cn(
          "h-full transition-[width] duration-[var(--ct-dur-slow)] ease-[var(--ct-ease)] relative",
          fillClassName ?? "bg-[var(--ct-status-success)]",
        )}
        style={{ width: `${pct}%` }}
      >
        {!isPlain ? (
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[var(--ct-surface-3)] to-transparent w-full h-full animate-[shimmer_var(--ct-dur-shimmer)_infinite]" />
        ) : null}
      </div>
    </div>
  );
}
