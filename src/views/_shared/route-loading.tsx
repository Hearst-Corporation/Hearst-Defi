import { cn } from "@/lib/cn";

/** Greenfield route skeletons — dark surfaces only (no zinc-100 / dark: variants). */

export function RouteLoadingPage({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("hc-page flex flex-col gap-10", className)}
      aria-busy="true"
      aria-label={label}
    >
      {children}
    </div>
  );
}

export function RouteLoadingHeader({
  titleWidth = "w-72",
  description = true,
}: {
  titleWidth?: string;
  description?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          "h-8 animate-pulse rounded-lg bg-surface-overlay",
          titleWidth,
        )}
      />
      {description ? (
        <div className="h-4 w-full max-w-xl animate-pulse rounded-lg bg-surface-overlay" />
      ) : null}
    </div>
  );
}

export function RouteLoadingPanel({
  className,
}: {
  className?: string;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-xl border border-border-subtle bg-surface-raised",
        className,
      )}
    />
  );
}

export function RouteLoadingKpiBand({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <RouteLoadingPanel key={i} className="h-28" />
      ))}
    </div>
  );
}
