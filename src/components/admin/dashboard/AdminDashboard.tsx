// AdminDashboard — composition root of the operator overview.
//
// Rebuilt from docs/front-dashboard-zero-rebuild-canon.md. What changed versus
// the retired `DashboardAssetsBoard`:
//
//   F1  every surface is an AdminDashboard* primitive, so cards RISE
//       (--ct-surface-raised). No BentoPanel → #000 slab.
//   F4  the fabricated 99.98% uptime, the render-time "last scan" and the
//       hardcoded green "Active / Monitoring / Live" pills are GONE. Tones are
//       derived from the data or the surface says nothing.
//   F5  the fixture-vault yield model (headlineApy, yieldPosture, risk.band,
//       the allocation orbit and NAV slot scoped to yield/defensive/btc-plus)
//       is dropped. The real platform aggregates stay.
//
// Pure presentation: the page loads, this composes.

import { MarketPricesPanel } from "@/components/admin/dashboard/market-prices-panel";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import type { OperatingReadinessView } from "@/lib/admin/dashboard-operating-view";
import type { HeroKpi } from "@/lib/admin/kpi-strip-view";
import type { OverviewClustersView } from "@/lib/admin/overview-clusters-view";
import type { ActionQueueItem, AuditTrailEntry } from "@/lib/data/cockpit";

import { AdminDashboardHero } from "./AdminDashboardHero";
import { AdminDashboardSection, AdminDashboardStack } from "./AdminDashboardSection";
import { AdminOperatingGrid } from "./AdminOperatingGrid";
import { AdminReadinessPanel } from "./AdminReadinessPanel";
import { AdminRiskStrip } from "./AdminRiskStrip";

export interface AdminDashboardProps {
  readiness: OperatingReadinessView;
  kpis: HeroKpi[];
  clusters: OverviewClustersView;
  queue: ActionQueueItem[];
  audit: AuditTrailEntry[];
  contractLabel: string;
}

export function AdminDashboard({
  readiness,
  kpis,
  clusters,
  queue,
  audit,
  contractLabel,
}: AdminDashboardProps) {
  return (
    <AdminDashboardStack>
      <AdminDashboardHero
        posture={readiness.posture}
        postureLabel={readiness.postureLabel}
        blurb={readiness.postureBlurb}
        contractLabel={contractLabel}
        pendingCount={queue.length}
      />

      <AdminDashboardSection
        title="Platform"
        description="Aggregates across every vault, read from the platform record. A figure that has no value shows an em dash, never a zero."
      >
        <div className="overflow-hidden rounded-[var(--ct-radius-xl)] border border-[var(--ct-border-soft)] bg-[var(--ct-surface-raised)]">
          <AdminKpiStripPanel kpis={kpis} embedded />
        </div>
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Readiness"
        description="Every factor is derived from a signal that actually resolved. A signal with no data reads as awaiting, never as healthy."
      >
        <AdminReadinessPanel view={readiness} />
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Operating domains"
        description="Capital, clients, governance and exposure — each drilling through to its own operator surface."
      >
        <AdminOperatingGrid view={clusters} />
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Pending work and record"
        description="What is waiting on an operator, and what has been recorded."
      >
        <AdminRiskStrip queue={queue} audit={audit} />
      </AdminDashboardSection>

      <AdminDashboardSection
        title="Market context"
        description="Spot reference only. Contextual — not a valuation of the reserve and not a return projection."
      >
        <MarketPricesPanel />
      </AdminDashboardSection>
    </AdminDashboardStack>
  );
}
