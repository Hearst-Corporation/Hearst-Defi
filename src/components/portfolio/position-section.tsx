/**
 * PositionSection — a static, always-open section card on the position detail
 * page. (Formerly a collapsible accordion — the fold was dropped: every section
 * renders expanded, stacked, no click required.) Card shell + header
 * (title / optional subtitle) + hairline-divided body. Pure render, server
 * component. Token-only.
 */

import type { ReactNode } from "react";

export function PositionSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Legacy accordion props — accepted for call-site compatibility, ignored. */
  sectionKey?: string;
  positionId?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-[var(--ct-shadow-soft)] overflow-hidden">
      <div className="flex flex-col gap-1 p-5">
        <h3 className="ct-section-title m-0">{title}</h3>
        {subtitle ? <p className="ct-metric-caption">{subtitle}</p> : null}
      </div>
      <div className="border-t border-[var(--ct-border-soft)]">{children}</div>
    </section>
  );
}
