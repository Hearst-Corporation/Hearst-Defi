// Admin page shell — the single canonical structure for every admin surface.
//
// Freezes the /admin/customers grammar so all admin pages mount identically:
//   AdminPageShell  → outer box (bg-surface-page) + AdminPageHeader
//     AdminSectionCard → welded section (bg-surface-card): optional KPI strip
//       header (black) → optional sub-header → body (Catalyst table / content)
//
// One source of truth: change the shell once, every admin page follows. Built
// purely on existing primitives (AdminPageHeader, AdminKpiStripPanel, Catalyst
// Table) — no new visual vocabulary, no hardcoded surfaces.

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import {
  AdminKpiStripPanel,
} from "@/components/admin/dashboard/admin-kpi-strip-panel";
import type { HeroKpi } from "@/lib/data/cockpit";

/* ── Shared Catalyst table chrome ───────────────────────────────────────────
 * Centralized so pages stop redeclaring these literals (the drift source).
 *  - TABLE_HEAD: nano uppercase head cells, transparent bg.
 *  - TABLE_WRAP: keep Catalyst's overflow-x-auto LOCAL to the card (no bleed).
 *  - ROW: hairline rows with a faint hover.                                   */
export const TABLE_HEAD = "bg-transparent ct-bento-label";
export const TABLE_WRAP =
  "max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap";
export const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]";

/**
 * Outer admin page box + canonical header. Every admin page wraps its body in
 * this so the page surface, padding rhythm, and title grammar are identical.
 *
 * Canon API: `titleLead` + `titleAccent` + `contextLabel` + `headerActions`.
 * Legacy/detail API: `title` + `eyebrow` + `description` + `lead` + `actions`
 * (forwarded to AdminPageHeader for detail pages that need a back-link or a
 * single-string title — keeps those pages on the canonical shell, not a custom div).
 */
export function AdminPageShell({
  titleLead,
  titleAccent,
  contextLabel,
  headerActions,
  title,
  eyebrow,
  description,
  lead,
  actions,
  children,
  className,
}: {
  titleLead?: string;
  titleAccent?: string;
  contextLabel?: string;
  headerActions?: ReactNode;
  /** Legacy single-string title (detail pages). */
  title?: string;
  eyebrow?: string;
  description?: ReactNode;
  /** Back-link or slot rendered above the title. */
  lead?: ReactNode;
  /** Right-aligned actions below the rule (legacy). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8",
        className,
      )}
    >
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead={titleLead}
          titleAccent={titleAccent}
          contextLabel={contextLabel}
          title={title}
          eyebrow={eyebrow}
          description={description}
          lead={lead}
          actions={actions}
          // CTA on the SAME line as the title (right-aligned), not below the rule.
          titleRowEnd={headerActions}
        />
        {children}
      </div>
    </div>
  );
}

/**
 * Welded section card — the /customers "Investor Base" shape: a single
 * bg-surface-card box that fuses (top → bottom):
 *   1. an optional KPI strip (embedded, with its own black header + CTA),
 *   2. an optional sub-header (title + caption + trailing slot),
 *   3. the body (a Catalyst table, an empty state, or any content).
 *
 * This is the canonical replacement for the ad-hoc mix of BentoPanel /
 * border-[var(--ct-border)] sections that had started to diverge across admin pages.
 */
export function AdminSectionCard({
  kpis,
  kpiTitle,
  kpiSubtitle,
  kpiAction,
  title,
  subtitle,
  headerTrailing,
  ariaLabel,
  children,
  className,
}: {
  /** When set, renders an embedded KPI strip at the top of the card. */
  kpis?: HeroKpi[];
  kpiTitle?: string;
  kpiSubtitle?: string;
  kpiAction?: ReactNode;
  /** Optional sub-header below the KPI strip (or at the top if no KPIs). */
  title?: ReactNode;
  subtitle?: ReactNode;
  headerTrailing?: ReactNode;
  ariaLabel?: string;
  children?: ReactNode;
  className?: string;
}) {
  const hasSubHeader = Boolean(title || subtitle || headerTrailing);
  return (
    <section
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card shadow-sm",
        className,
      )}
      aria-label={ariaLabel}
    >
      {kpis && kpis.length > 0 ? (
        <AdminKpiStripPanel
          kpis={kpis}
          title={kpiTitle}
          subtitle={kpiSubtitle}
          action={kpiAction}
          embedded
        />
      ) : null}

      {/* Section header — the canonical "Investor Base / New investor" bar:
          flex items-center justify-between, title stack left, shrink-0 slot right. */}
      {hasSubHeader ? (
        <div className="flex items-center justify-between gap-4 border-b border-[var(--ct-border-soft)] p-5">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="ct-section-title">{title}</h2> : null}
            {subtitle ? <p className="ct-metric-caption">{subtitle}</p> : null}
          </div>
          {headerTrailing ? (
            <div className="flex shrink-0 items-center gap-2">{headerTrailing}</div>
          ) : null}
        </div>
      ) : null}

      {children}
    </section>
  );
}
