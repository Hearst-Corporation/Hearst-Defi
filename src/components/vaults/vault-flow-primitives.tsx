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
    <div className="vault-panel-header">
      <div className="vault-panel-header__stack">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h3 className="h3 ct-text-body">{title}</h3>
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
    <div className="ct-metric-nested">
      <span className="stat-label">{label}</span>
      <span
        className={cn(
          "h4 tabular mono ct-text-strong ct-metric-nested__value",
          valueClassName,
        )}
      >
        {children}
      </span>
    </div>
  );
}

/** Label / value row inside a vault-panel-body (confirmed, detail panels). */
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
    <div className="vault-panel-row">
      <div className="vault-panel-row__stack">
        <span className="eyebrow ct-text-muted">{label}</span>
        <span className="body-sm tabular mono ct-text-primary">{value}</span>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Accent inline action link inside vault panels (explorer, calendar, etc.). */
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
        "body-xs ct-text-accent-strong font-medium no-underline hover:underline",
        className,
      )}
    >
      {children}
    </a>
  );
}

/** Inset block inside vault-panel-body (soft-lock bar, multi-line fields). */
export function VaultPanelInsetBlock({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("vault-panel-inset-block", className)}>{children}</div>;
}
