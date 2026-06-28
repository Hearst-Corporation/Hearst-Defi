import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function VaultPanelHeader({
  title,
  eyebrow,
  trailing,
}: {
  title: string;
  eyebrow?: string;
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow ? (
          <p className="ct-bento-label">
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-[length:var(--ct-text-xs)] font-semibold uppercase tracking-wider text-white">
          {title}
        </h3>
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </div>
  );
}

export function VaultKpiCell({
  label,
  children,
  valueClassName,
}: {
  label: string;
  children: React.ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset p-4">
      <span className="ct-bento-label">
        {label}
      </span>
      <span
        className={cn(
          "text-[length:var(--ct-text-xl-fixed)] font-medium leading-none tracking-tight text-white tabular-nums",
          valueClassName,
        )}
      >
        {children}
      </span>
    </div>
  );
}

export function VaultDetailRow({
  label,
  value,
  action,
}: {
  label: string;
  value: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-border-soft)] py-3">
      <div className="flex min-w-0 flex-col gap-1">
        <span className="ct-bento-label">
          {label}
        </span>
        <span className="text-[length:var(--ct-text-xs)] font-medium text-white tabular-nums">
          {value}
        </span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function VaultPanelLink({
  href,
  children,
  className,
  ...rest
}: React.ComponentProps<"a">) {
  return (
    <a
      {...rest}
      href={href}
      className={cn(
        "text-[length:var(--ct-text-2xs)] font-medium text-[var(--ct-accent)] no-underline transition-colors hover:underline",
        className,
      )}
    >
      {children}
    </a>
  );
}

export function VaultPanelInsetBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-[var(--ct-border-soft)] bg-surface-inset p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
