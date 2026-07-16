// ProductProgress — compact term progress (month N of M, on-track status).

import { cn } from "@/lib/cn";

interface ProductProgressProps {
  currentMonth: number | null;
  totalMonths: number | null;
  statusLabel?: string | null;
  className?: string;
}

export function ProductProgress({
  currentMonth,
  totalMonths,
  statusLabel,
  className,
}: ProductProgressProps) {
  const monthLabel =
    currentMonth != null && totalMonths != null
      ? `Month ${currentMonth} of ${totalMonths}`
      : "—";

  return (
    <div className={cn("flex flex-wrap items-center gap-[var(--ct-space-3)]", className)}>
      <span className="body-sm ct-text-body font-medium">{monthLabel}</span>
      {statusLabel ? (
        <span className="rounded-full border border-[var(--ct-border-accent)] px-[var(--ct-space-2)] py-[var(--ct-space-0_5)] body-xs font-medium text-[var(--ct-accent)]">
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
