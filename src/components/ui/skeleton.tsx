import { cn } from "@/lib/cn";

/**
 * Reusable skeleton placeholder for loading states.
 *
 * Uses Tailwind v4 animate-pulse and a subtle shimmer gradient.
 */
interface SkeletonProps {
  className?: string;
  variant?: "rect" | "circle" | "text";
}

export function Skeleton({ className, variant = "rect" }: SkeletonProps) {
  const baseClasses =
    "animate-pulse ct-surface-2 rounded-sm relative overflow-hidden";

  const variantClasses = {
    rect: "",
    circle: "rounded-full",
    text: "h-4 rounded",
  };

  return (
    <div
      className={cn(baseClasses, variantClasses[variant], className)}
      aria-hidden="true"
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_var(--ct-dur-shimmer)_infinite] bg-gradient-to-r from-transparent via-[var(--ct-surface-1)] to-transparent" />
    </div>
  );
}

/**
 * Skeleton card for dashboard sections.
 */
export function SkeletonCard() {
  return (
    <div className="space-y-4 p-6 rounded-xl border border-[var(--ct-border-soft)] ct-surface-0">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-3">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

/**
 * Skeleton for metric badges.
 */
export function SkeletonMetric() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-3 w-20" variant="text" />
      <Skeleton className="h-8 w-32" />
    </div>
  );
}
