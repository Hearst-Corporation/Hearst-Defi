import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Series1DashboardPage({ children }: { children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-[var(--ct-space-5)]">{children}</div>;
}

export function Series1DashboardSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title?: string;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const headed = Boolean(title || description || actions);
  return (
    <section className={cn("flex min-w-0 flex-col", className)}>
      {headed ? (
        <div className="mb-[var(--ct-space-3)] border-t border-[var(--ct-border-soft)] pt-[var(--ct-space-4)]">
          <div className="flex flex-wrap items-start justify-between gap-x-[var(--ct-space-6)] gap-y-[var(--ct-space-2)]">
            <div className="min-w-0">
              {title ? (
                <h2
                  className="m-0 font-semibold text-[var(--ct-text-strong)]"
                  style={{ fontSize: "var(--ct-text-sm)" }}
                >
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p
                  className="m-0 mt-[var(--ct-space-2)] max-w-[68ch] leading-relaxed text-[var(--ct-text-muted)]"
                  style={{ fontSize: "var(--ct-text-2xs)" }}
                >
                  {description}
                </p>
              ) : null}
            </div>
            {actions ? (
              <div className="flex shrink-0 items-center gap-[var(--ct-space-2)]">{actions}</div>
            ) : null}
          </div>
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Series1DashboardCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[var(--ct-radius-xl)]",
        "bg-[color-mix(in_srgb,var(--ct-bg-deep)_65%,var(--ct-surface-page))]",
        "ring-1 ring-[var(--ct-border)] shadow-[var(--ct-shadow-elevated)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Series1DashboardCardHeader({
  title,
  caption,
  trailing,
}: {
  title: string;
  caption?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-[var(--ct-space-4)] gap-y-[var(--ct-space-1)] border-b border-[var(--ct-border-soft)] px-[var(--ct-space-5)] py-[var(--ct-space-3)]">
      <div className="min-w-0">
        <h3
          className="m-0 font-semibold uppercase tracking-[0.12em] text-[var(--ct-text-muted)]"
          style={{ fontSize: "var(--ct-text-2xs)" }}
        >
          {title}
        </h3>
        {caption ? (
          <p
            className="m-0 mt-[var(--ct-space-1)] leading-relaxed text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            {caption}
          </p>
        ) : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function Series1DashboardInset({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-[color-mix(in_srgb,var(--ct-bg-deep)_80%,var(--ct-surface-page))]",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Series1DashboardRow({
  label,
  value,
  hint,
  muted = false,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Value did not resolve — render it quiet instead of authoritative. */
  muted?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-[var(--ct-space-4)] px-[var(--ct-space-5)] py-[var(--ct-space-3)] first:pt-[var(--ct-space-4)] last:pb-[var(--ct-space-4)] [&+&]:border-t [&+&]:border-[var(--ct-border-soft)]">
      <span
        className="min-w-0 text-[var(--ct-text-muted)]"
        style={{ fontSize: "var(--ct-text-xs)" }}
      >
        {label}
      </span>
      <span className="flex min-w-0 flex-col items-end text-right">
        <span
          className={cn(
            "font-semibold tabular-nums",
            muted ? "text-[var(--ct-text-faint)]" : "text-[var(--ct-text-strong)]",
          )}
          style={{ fontSize: "var(--ct-text-xs)" }}
        >
          {value}
        </span>
        {hint ? (
          <span
            className="mt-[var(--ct-space-1)] text-[var(--ct-text-faint)]"
            style={{ fontSize: "var(--ct-text-nano)" }}
          >
            {hint}
          </span>
        ) : null}
      </span>
    </div>
  );
}
