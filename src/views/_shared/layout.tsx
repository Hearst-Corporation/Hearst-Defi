import Link from "next/link";

import { cn } from "@/lib/cn";
import { Button } from "@/ui/button";

export function PageLayout({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("hc-page space-y-8", className)}>{children}</div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  meta,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  meta?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-2">
        {eyebrow ? <p className="hc-eyebrow">{eyebrow}</p> : null}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {meta ? (
            <span className="text-xs font-medium text-subtle">{meta}</span>
          ) : null}
        </div>
        {description ? (
          <p className="max-w-3xl text-sm leading-relaxed text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Section({
  index,
  title,
  description,
  children,
}: {
  index?: string;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {index ? (
            <span className="font-mono text-xs text-subtle">{index}</span>
          ) : null}
          {title}
        </h2>
        {description ? (
          <p className="text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function Panel({
  title,
  description,
  children,
  footer,
}: {
  title?: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {title ? (
        <div className="border-b border-border-subtle px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          {description ? (
            <div className="mt-1 text-xs text-muted">{description}</div>
          ) : null}
        </div>
      ) : null}
      <div>{children}</div>
      {footer ? (
        <div className="border-t border-border-subtle px-5 py-4 text-xs text-muted">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export function RowList({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-border-subtle">{children}</div>;
}

export function Row({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-3.5">
      <div className="min-w-0">
        <p className="text-sm text-muted">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-subtle">{hint}</p> : null}
      </div>
      <p className="text-sm font-medium text-foreground tabular-nums">{value}</p>
    </div>
  );
}

export function PageActions({
  primary,
  secondary,
}: {
  primary: { href: string; label: string };
  secondary?: { href: string; label: string };
}) {
  return (
    <>
      {secondary ? (
        <Link href={secondary.href}>
          <Button variant="secondary">{secondary.label}</Button>
        </Link>
      ) : null}
      <Link href={primary.href}>
        <Button>{primary.label}</Button>
      </Link>
    </>
  );
}

export function Disclaimer({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs leading-relaxed text-subtle">{children}</p>
  );
}
