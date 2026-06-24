import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/**
 * ds-kit — shared presentational primitives for the /admin/design-system
 * reference page. Server components only; every visual leans on existing
 * Cockpit tokens / utility classes + the page-scoped `design-system.css`.
 *
 * These helpers exist ONLY to document the design system. They are not product
 * UI and must not be imported by product/admin feature surfaces.
 */

/** Top-level documentation section with an anchor + eyebrow + title. */
export function DsSection({
  id,
  index,
  title,
  lead,
  children,
}: {
  id: string;
  index: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="ds-section" aria-labelledby={`${id}-title`}>
      <header className="ds-section__head">
        <p className="eyebrow">Section {index}</p>
        <h2 id={`${id}-title`} className="h2 ct-text-strong">
          {title}
        </h2>
        {lead ? <p className="body-sm ct-text-muted max-w-prose">{lead}</p> : null}
      </header>
      {children}
    </section>
  );
}

/** A titled sub-group inside a section. */
export function DsBlock({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="ds-block">
      <div className="ds-block__head">
        <h3 className="h4 ct-text-body">{title}</h3>
        {hint ? <span className="body-xs ct-text-muted">{hint}</span> : null}
      </div>
      <div className="ds-block__body">{children}</div>
    </div>
  );
}

/** Honest "this is a documentation example, not real data" marker. */
export function DsExampleTag({ label = "Design System example" }: { label?: string }) {
  return (
    <span className="ds-example-tag">
      <span className="ds-example-tag__dot" aria-hidden="true" />
      {label}
    </span>
  );
}

/** A framed live specimen with a caption + optional source class hint. */
export function DsSpecimen({
  caption,
  classHint,
  example,
  stack = false,
  children,
}: {
  caption: string;
  classHint?: string;
  /** Render the honest "Design System example" tag in the caption. */
  example?: boolean;
  stack?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="ds-specimen">
      <div className="ds-specimen__caption">
        <span className="stat-label ct-text-muted">{caption}</span>
        {example ? (
          <DsExampleTag />
        ) : classHint ? (
          <span className="ds-token">{classHint}</span>
        ) : null}
      </div>
      <div
        className={cn(
          "ds-specimen__stage",
          stack && "ds-specimen__stage--stack",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** Color / surface / border swatch. */
export function DsSwatch({
  chipClass,
  name,
  token,
}: {
  chipClass: string;
  name: string;
  token: string;
}) {
  return (
    <div className="ds-swatch">
      <div className={cn("ds-swatch__chip", chipClass)} aria-hidden="true" />
      <div className="ds-swatch__meta">
        <span className="body-xs ct-text-body">{name}</span>
        <span className="ds-swatch__token">{token}</span>
      </div>
    </div>
  );
}

/** Do / Don't paired guidance column. */
export function DsDoDont({
  tone,
  title,
  children,
}: {
  tone: "do" | "dont";
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "ds-dodont__col",
        tone === "do" ? "ds-dodont__col--do" : "ds-dodont__col--dont",
      )}
    >
      <span className="ds-dodont__head">
        <span aria-hidden="true">{tone === "do" ? "✓" : "✗"}</span>
        {title}
      </span>
      {children}
    </div>
  );
}

/** A single "do not use" anti-pattern card — described, never rendered live. */
export function DsAntiCard({
  title,
  why,
  fix,
}: {
  title: string;
  why: string;
  fix: string;
}) {
  return (
    <div className="ds-anti-card">
      <div className="ds-anti-card__head">
        <span className="ds-anti-card__mark" aria-hidden="true">
          ✗
        </span>
        <span className="ds-anti-card__title">{title}</span>
      </div>
      <p className="body-xs ct-text-muted m-0">{why}</p>
      <p className="ds-anti-card__fix body-xs ct-text-body m-0">
        <span className="ds-anti-card__fix-key">Do</span>
        <span>{fix}</span>
      </p>
    </div>
  );
}
