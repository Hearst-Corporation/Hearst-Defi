import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * Shared bento primitives — the Portfolio canon, pure Tailwind.
 *
 * One source of truth for the panel chrome the product surfaces repeat
 * (vaults flow, onboarding, profile, proof-center): black panel +
 * hairline border, micro uppercase labels, accent-green (#A7FB90) CTAs.
 *
 * Extracted from the per-file copies the bento conversion left behind
 * (BentoPanel / BentoHeader / SectionHeader / TermTile / KpiCell /
 * FieldLabel / PRIMARY_BTN / SECONDARY_BTN). Keep these classes byte-identical
 * to the Portfolio page (src/app/(product)/portfolio/page.tsx) — they are the
 * canon other surfaces are checked against.
 */

/** Panel surface: rounded-2xl black card with a hairline border. */
export function BentoPanel({
  children,
  className,
  ...rest
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...rest}
      className={cn(
        "rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col",
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
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  trailing?: ReactNode;
  /** Heading level for the title (default h2). */
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-end justify-between p-5 border-b border-white/5",
        className,
      )}
    >
      <div className="flex flex-col gap-1.5">
        <Heading className="text-[11px] font-bold text-zinc-400 uppercase tracking-[0.15em] leading-none">
          {title}
        </Heading>
        {subtitle ? (
          <p className="text-[12px] text-zinc-500 tracking-wide">{subtitle}</p>
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
  const cls = cn(
    "text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500",
    className,
  );
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
      <LabelTag className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
        {label}
      </LabelTag>
      <ValueTag
        className={cn(
          "text-[18px] font-medium leading-none tracking-tight tabular-nums",
          dl && "m-0",
          accent ? "text-[#A7FB90]" : "text-white",
        )}
      >
        {value}
      </ValueTag>
      {sub ? (
        <SubTag
          className={cn(
            "text-[10px] text-zinc-500 tracking-wide",
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
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-white/5 py-3 last:border-b-0",
        className,
      )}
    >
      <span className="text-[13px] text-zinc-400">{label}</span>
      <span className="text-[13px] font-medium text-white tabular-nums">
        {children}
      </span>
    </div>
  );
}

/** Accent-green primary CTA class string. */
export const BENTO_PRIMARY_BTN =
  "inline-flex items-center justify-center bg-[#A7FB90] text-zinc-900 font-bold rounded-lg px-4 py-2.5 text-[13px] transition-colors hover:bg-[#A7FB90]/90 disabled:opacity-50 disabled:cursor-not-allowed";

/** Neutral secondary CTA class string. */
export const BENTO_SECONDARY_BTN =
  "inline-flex items-center justify-center border border-white/10 bg-white/5 text-white font-medium rounded-lg px-4 py-2.5 text-[13px] transition-colors hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed";
