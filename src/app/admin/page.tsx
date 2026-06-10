// Historical note (2026-05-26): previously this page redirected to /admin/dashboard.
// Replaced by the unified 3-column cockpit: Action Queue | Live Metrics | Live Ops
// (Stream M — admin-cockpit-unified).

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ActionQueue } from "@/components/admin/cockpit/action-queue";
import { AuditTrailRolling } from "@/components/admin/cockpit/audit-trail-rolling";
import { HeroStrip } from "@/components/admin/cockpit/hero-strip";
import { LiveMetrics } from "@/components/admin/cockpit/live-metrics";
import { LiveOps } from "@/components/admin/cockpit/live-ops";
import { requireAdmin } from "@/lib/auth/require-admin";
import { loadCockpitPayload } from "@/lib/data/cockpit";

export const dynamic = "force-dynamic";

export default async function AdminCockpit() {
  await requireAdmin();

  const payload = await loadCockpitPayload();

  return (
    <div className="space-y-8">
      <AdminPageHeader title="Dashboard" />

      {/* Hero Strip — 6 cross-vault KPIs */}
      <section aria-label="Cross-vault KPIs">
        <HeroStrip kpis={payload.heroKpis} />
      </section>

      {/* 3-column cockpit */}
      <section
        aria-label="Cockpit operations"
        className="grid gap-6 lg:grid-cols-3"
      >
        {/* Column 1 — Action Queue */}
        <ActionQueue items={payload.actionQueue} />

        {/* Column 2 — Live Metrics */}
        <LiveMetrics vaults={payload.vaultMetrics} />

        {/* Column 3 — Live Ops */}
        <LiveOps
          inngestJobs={payload.inngestJobs}
          sentryStats={payload.sentryStats}
          onChainEvents={payload.onChainEvents}
        />
      </section>

      {/* Audit Trail — rolling 20 events */}
      <section aria-label="Audit trail">
        <AuditTrailRolling entries={payload.auditTrail} />
      </section>
    </div>
  );
}
