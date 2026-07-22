import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { HeroKpi } from "@/lib/data/cockpit";
import { surfaceClassName } from "@/lib/ui/surface-classes";

import { DashboardKpiStrip } from "./kpi-strip";

interface AdminKpiStripPanelProps {
  kpis: HeroKpi[];
  /** Optional header above the strip (Portfolio "Capital & Yield" canon). */
  title?: string;
  subtitle?: string;
  /** Optional action (e.g. a primary button) rendered right-aligned in the header. */
  action?: ReactNode;
  /**
   * When true, the panel is rendered INSIDE a parent card (e.g. a list section
   * that also holds the table). It then drops its own outer card chrome
   * (border/radius/shadow) and just welds header → KPI → next content with a
   * bottom hairline — exactly like Portfolio's strip sitting above its table.
   */
  embedded?: boolean;
}

/**
 * Renders the admin KPI strip with the EXACT Portfolio "Capital & Yield" shape:
 *  - Standalone: OUTER box = black card (`bg-surface-card` + hairline border),
 *    rounded only on the outside.
 *  - Embedded: no outer chrome, welded to the table below by a bottom hairline.
 *  - Black header on top (title + subtitle + optional right-aligned action).
 *  - FLAT KPI cells on the grey inset surface — no rounded corners of their own.
 *
 * `DashboardKpiStrip` is kept (NOT replaced by a bare BentoKpiStrip) so each cell
 * keeps its provenance dot (non-negotiable #2) and its sublabel/delta line.
 *
 * `admin-kpi-strip-panel` is kept as a marker so the anti-bleed rule in
 * admin-crm.css (flex: 0 0 auto on a direct shell child) still pins the panel to
 * its natural content height.
 */
export function AdminKpiStripPanel({
  kpis,
  title,
  subtitle,
  action,
  embedded = false,
}: AdminKpiStripPanelProps) {
  const hasHeader = Boolean(title || action);
  return (
    <section
      className={cn(
        "admin-kpi-strip-panel flex flex-col overflow-hidden",
        embedded
          ? "border-b border-[var(--ct-border-soft)]"
          : surfaceClassName("secondary"),
      )}
    >
      {hasHeader ? (
        <div className="flex items-center justify-between gap-4 border-b border-[var(--ct-border-soft)] p-5">
          <div className="flex min-w-0 flex-col gap-1">
            {title ? <h2 className="ct-section-title">{title}</h2> : null}
            {subtitle ? (
              <p className="ct-metric-caption">{subtitle}</p>
            ) : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <DashboardKpiStrip kpis={kpis} />
    </section>
  );
}
