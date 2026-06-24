import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";

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
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_var(--ct-dur-shimmer)_infinite] bg-linear-to-r from-transparent via-(--ct-surface-1) to-transparent" />
    </div>
  );
}

/**
 * Skeleton card for dashboard sections.
 */
export function SkeletonCard() {
  return (
    <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-4)]">
      <Skeleton className="h-6 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-[var(--ct-space-3)]">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-24" />
      </div>
    </Card>
  );
}

/**
 * Shared loading skeleton for admin pages.
 */
export function AdminPageLoading() {
  return (
    <div className="animate-in fade-in duration-(--ct-dur-slower)">
      <div className="admin-doc-stack--actions">
        <Skeleton className="h-3 w-32" variant="text" />
        <div className="admin-doc-inline-row">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>

      <div className="admin-doc-stack">
        <Skeleton className="h-8 w-full" />
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

