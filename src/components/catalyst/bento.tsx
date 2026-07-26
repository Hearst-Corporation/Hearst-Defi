/**
 * Catalyst Bento — canonical Hearst bento layout primitives. Token-only.
 * `src/components/ui/bento` re-exports this.
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { ProvenanceBadge, type Provenance } from "@/components/ui/provenance-badge";

/**
 * Shared bento primitives — token-backed surfaces for product + admin pages.
 *
 * Uses cockpit tokens (--ct-*) and .ct-glass-panel for module chrome instead of
 * ad-hoc bg-surface-card / border-white/* hardcodes. Typography via .ct-bento-* classes
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
      className={cn("ct-bento-page", className)}
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
    <div
      className={cn(
        "flex min-w-0 flex-col items-center gap-2 p-5 text-center",
        className,
      )}
    >
      <LabelTag className="ct-bento-label block w-full min-w-0 truncate">
        {label}
      </LabelTag>
      <ValueTag
        className={cn(
          "ct-bento-metric block w-full min-w-0 truncate [&>*]:justify-center",
          dl && "m-0",
          accent && "ct-bento-metric--accent",
        )}
      >
        {value}
      </ValueTag>
      {sub ? (
        <SubTag
          className={cn(
            "block w-full min-w-0 truncate text-[length:var(--ct-text-nano)] ct-text-muted tracking-wide",
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

/**
 * Canonical KPI strip — the standard headline-metric bar used across pages.
 * 1→N responsive grid on the page-surface grey, tiles separated by hairlines,
 * micro-label + 22px value (Portfolio canon). Fully tokenized: surface =
 * --ct-surface-1, dividers = --ct-border-soft, label = .ct-bento-label.
 * Use this instead of hand-rolling a `grid bg-surface-inset border-[var(--ct-border-soft)]` block.
 */
export interface BentoKpiItem {
  label: ReactNode;
  value: ReactNode;
  /** Accent-green value (single green) when true. */
  accent?: boolean;
  /** Optional muted caption under the value (e.g. "Net deposits", "3-year lock"). */
  caption?: ReactNode;
  /** Optional provenance dot rendered next to the label. Non-breaking: omit to keep existing layout. */
  provenance?: Provenance;
}

export function BentoKpiStrip({
  items,
  title,
  subtitle,
  className,
  ariaLabel,
}: {
  items: BentoKpiItem[];
  /** Optional header above the strip (Portfolio "Capital & Yield" canon). */
  title?: ReactNode;
  subtitle?: ReactNode;
  className?: string;
  ariaLabel?: string;
}) {
  const cols =
    items.length >= 4
      ? "md:grid-cols-4"
      : items.length === 3
        ? "md:grid-cols-3"
        : items.length === 2
          ? "md:grid-cols-2"
          : "md:grid-cols-1";

  // Header + strip soudés, ZÉRO marge externe : le bloc se colle au header en
  // haut et au contenu (tableau/donut) en bas. Bordure basse = soudure au tableau.
  return (
    <div className={cn("flex flex-col bg-[var(--ct-surface-inset)]", className)}>
      {title ? (
        <div className="flex flex-col gap-1.5 border-b border-[var(--ct-border-soft)] p-5 md:px-6">
          <div className="ct-bento-label">{title}</div>
          {subtitle ? (
            <div className="text-[length:var(--ct-text-2xs)] ct-text-muted">{subtitle}</div>
          ) : null}
        </div>
      ) : null}
      <div
        aria-label={ariaLabel}
        className={cn(
          "grid grid-cols-1 border-b border-[var(--ct-border-soft)]",
          cols,
        )}
      >
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              // min-w-0 lets long labels/values truncate instead of forcing
              // horizontal overflow (grid children default to min-width:auto).
              // items-center + text-center: label, value and any inline logo are
              // centered horizontally in the box.
              "flex min-w-0 flex-col items-center gap-2 p-5 text-center md:px-6",
              // Hairline between tiles: bottom on stacked mobile, right on desktop.
              i < items.length - 1 &&
                "border-b border-[var(--ct-border-soft)] md:border-b-0 md:border-r",
            )}
          >
            {item.provenance != null ? (
              <div className="flex min-w-0 items-center justify-center gap-1.5">
                <ProvenanceBadge kind={item.provenance} variant="strip" />
                <span className="ct-bento-label min-w-0 truncate">
                  {item.label}
                </span>
              </div>
            ) : (
              <div className="ct-bento-label block w-full min-w-0 truncate">
                {item.label}
              </div>
            )}
            <div
              className={cn(
                // Value on a SINGLE line (line-clamp-1): a long token like
                // "A3 Pro Hyd 660T 12.5J mix" truncates cleanly instead of
                // wrapping into an uncadred multi-line overflow. Value scales
                // down in the narrow shell slot (chat rail open) and rises to
                // the 22px canon on wide. Inline logo/value flex is centered.
                "block w-full min-w-0 truncate text-[length:var(--ct-text-lg)] font-medium leading-tight tracking-tight lg:text-[length:var(--ct-text-2xl)] [&>*]:justify-center",
                item.accent ? "ct-text-accent" : "ct-text-strong",
              )}
            >
              {item.value}
            </div>
            {item.caption != null ? (
              <div className="ct-metric-caption block w-full min-w-0 truncate">
                {item.caption}
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
