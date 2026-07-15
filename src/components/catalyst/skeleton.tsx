/**
 * Catalyst Skeleton — canonical loading-state placeholders for Hearst Connect.
 *
 * Token-only (animation, surfaces and spacing come from `--ct-*` / the `.ct-*`
 * class layer in cockpit.css) plus a subtle shimmer gradient. This is the canon:
 * import Skeleton from `@/components/catalyst/skeleton`.
 * Dark mode only — no `dark:` modifiers.
 */

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
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_var(--ct-dur-shimmer)_infinite] bg-linear-to-r from-transparent via-(--ct-surface-1) to-transparent" />
    </div>
  );
}

interface AdminTableLoadingProps {
  /** Screen-reader label, e.g. "Loading audit log". */
  label: string;
  /** Placeholder rows in the table band. */
  rows?: number;
}

/**
 * Grey opaque bento skeleton for admin table pages — header + actions, then a
 * table band. The opaque grey shell masks the ambient halo during load.
 *
 * Canon for admin loading.tsx routes: import this instead of hand-rolling the
 * markup (COMPONENT_INDEX: "if it already exists, REUSE it").
 */
export function AdminTableLoading({ label, rows = 5 }: AdminTableLoadingProps) {
  return (
    <div
      className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page [--gutter:theme(spacing.8)] mb-8"
      aria-busy="true"
      aria-label={label}
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-[var(--ct-border)]">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="h-3 w-32 bg-surface-inset animate-pulse rounded" />
            <div className="h-7 w-48 bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="flex gap-3 shrink-0">
            <div className="h-9 w-28 bg-surface-inset animate-pulse rounded-lg" />
            <div className="h-9 w-28 bg-surface-inset animate-pulse rounded-lg" />
          </div>
        </div>

        {/* TABLE */}
        <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-[var(--ct-border-soft)]">
            <div className="h-8 w-full bg-surface-inset animate-pulse rounded" />
          </div>
          <div className="divide-y divide-white/5">
            {Array.from({ length: rows }).map((_, row) => (
              <div key={row} className="flex items-center justify-between gap-4 p-5">
                <div className="h-4 w-2/3 bg-surface-inset animate-pulse rounded" />
                <div className="h-4 w-20 bg-surface-inset animate-pulse rounded shrink-0" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
