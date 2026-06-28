import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared bento primitives — token-backed surfaces for product + admin pages.
 *
 * Uses cockpit tokens (--ct-*) and .ct-glass-panel for module chrome instead of
 * ad-hoc bg-black / border-white/* hardcodes. Typography via .ct-bento-* classes
 * in doc-flow.css.
 */

/** Outer page shell: graphite surface + padded body stack. */
export function BentoPageShell({
  children,
  className,
  testId,
  ...rest
}: React.HTMLAttributes<HTMLDivElement> & { testId?: string }) {
  return (
    <div
      {...rest}
      className={cn("ct-bento-page dark", className)}
      data-testid={testId}
    >
      <div className="ct-bento-page__body">{children}</div>
    </div>
  );
}

/** Panel surface: ct-glass-panel card with overflow clip. */
export function BentoPanel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "ct-glass-panel flex flex-col overflow-hidden shadow-none",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Panel header: uppercase title + optional subtitle, optional trailing slot. */
export function BentoHeader({
  title,
  subtitle,
  trailing,
  as: Heading = "h2",
  className,
  id,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  as?: "h2" | "h3";
  className?: string;
  id?: string;
}) {
  return (
    <div className={cn("ct-bento-panel-header", className)}>
      <div className="flex min-w-0 flex-col">
        <Heading id={id} className="ct-bento-card-title">
          {title}
        </Heading>
        {subtitle ? (
          <p className="ct-bento-card-subtitle">{subtitle}</p>
        ) : null}
      </div>
      {trailing ? (
        <div className="flex shrink-0 items-center gap-2 pb-0.5">{trailing}</div>
      ) : null}
    </div>
  );
}

/** Micro uppercase label (form field / KPI caption). */
export function BentoLabel({
  htmlFor,
  children,
  className,
}: {
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  const cls = cn("ct-bento-label", className);
  return htmlFor ? (
    <label htmlFor={htmlFor} className={cls}>
      {children}
    </label>
  ) : (
    <span className={cls}>{children}</span>
  );
}

/**
 * KPI tile: micro label + large value + optional sub caption.
 * `as="dl"` renders dt/dd for description-list semantics (proof-center);
 * default renders plain divs (term sheet).
 */
export function BentoKpiTile({
  label,
  value,
  sub,
  accent = false,
  as = "div",
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  accent?: boolean;
  as?: "div" | "dl";
  className?: string;
}) {
  const dl = as === "dl";
  const LabelTag = dl ? "dt" : "div";
  const ValueTag = dl ? "dd" : "div";
  const SubTag = dl ? "p" : "div";
  return (
    <div className={cn("flex flex-col gap-2 p-5", className)}>
      <LabelTag className="ct-bento-label">{label}</LabelTag>
      <ValueTag
        className={cn(
          "ct-bento-metric",
          dl && "m-0",
          accent && "ct-bento-metric--accent",
        )}
      >
        {value}
      </ValueTag>
      {sub ? (
        <SubTag
          className={cn(
            "text-[length:var(--ct-text-nano)] ct-text-muted tracking-wide",
            dl && "m-0",
          )}
        >
          {sub}
        </SubTag>
      ) : null}
    </div>
  );
}

/** Label/value detail row with a hairline divider. */
export function BentoDetailRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("ct-bento-detail-row", className)}>
      <span className="ct-bento-detail-row__label">{label}</span>
      <span className="ct-bento-detail-row__value">{children}</span>
    </div>
  );
}

/** Accent-green primary CTA class string. */
export const BENTO_PRIMARY_BTN =
  "inline-flex items-center justify-center rounded-lg bg-[var(--ct-accent)] px-4 py-2.5 text-[13px] font-bold text-zinc-900 transition-colors hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

/** Neutral secondary CTA class string. */
export const BENTO_SECONDARY_BTN =
  "inline-flex items-center justify-center rounded-lg border border-[var(--ct-border-soft)] bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)] px-4 py-2.5 text-[13px] font-medium text-[var(--ct-text-strong)] transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_10%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";
