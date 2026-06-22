import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";
import Link from "next/link";

import { FixtureVaultPills } from "@/components/admin/fixture-vault-pills";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { ManualSignalTrigger } from "@/components/admin/manual-signal-trigger";
import { RebalanceCard } from "@/components/admin/rebalance-card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { requestManualSignal } from "./actions";
import {
  adminSignalsVaultHref,
  resolveFixtureVaultId,
  withAdminVaultQuery,
} from "@/lib/vaults/dashboard-scope";
import { buildSignalsKpiStrip } from "@/lib/admin/signals-kpi-strip";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type StatusFilter = "pending" | "approved" | "executed" | "cancelled" | "all";

const VALID_STATUSES: StatusFilter[] = [
  "all",
  "pending",
  "approved",
  "executed",
  "cancelled",
];

function toFilter(raw: unknown): StatusFilter {
  if (typeof raw === "string" && VALID_STATUSES.includes(raw as StatusFilter)) {
    return raw as StatusFilter;
  }
  return "pending";
}

// ---------------------------------------------------------------------------
// Filter tabs
// ---------------------------------------------------------------------------

const TABS: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Executed", value: "executed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

function signalVaultScopeWhere(vaultId: string): Prisma.RebalanceEventWhereInput {
  return vaultId === "yield"
    ? {
        OR: [{ vaultRef: "yield" }, { vaultRef: null }],
      }
    : { vaultRef: vaultId };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

interface SignalsPageProps {
  searchParams: Promise<{ status?: string; vault?: string }>;
}

export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  const params = await searchParams;
  const activeStatus = toFilter(params.status);
  const vaultId = resolveFixtureVaultId(params.vault);
  const vaultQuery = params.vault ?? null;
  const vaultScope = signalVaultScopeWhere(vaultId);

  const where: Prisma.RebalanceEventWhereInput = {
    ...vaultScope,
    ...(activeStatus === "all" ? {} : { status: activeStatus }),
  };

  const events = await prisma.rebalanceEvent.findMany({
    where,
    orderBy: { triggeredAt: "desc" },
    take: 100,
  });

  // Count badges per status
  const counts = await prisma.rebalanceEvent.groupBy({
    where: vaultScope,
    by: ["status"],
    _count: { id: true },
  });
  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count.id]),
  );

  const signalKpis = buildSignalsKpiStrip(
    countMap,
    events[0]?.triggeredAt ?? null,
  );

  const isDev = process.env.NODE_ENV === "development";

  const manualSignalAction = async (ruleId: string, scopeVaultId?: string): Promise<string> => {
    "use server";
    return requestManualSignal(ruleId, scopeVaultId);
  };

  return (
    <>
      <AdminPageHeader
        titleLead="Vault"
        titleAccent="Rebalancing"
        contextLabel="Vaults"
        filters={
          <FixtureVaultPills
            activeVaultId={vaultId}
            resolveHref={adminSignalsVaultHref}
          />
        }
        actions={
          isDev ? (
            <ManualSignalTrigger action={manualSignalAction} vaultId={vaultId} />
          ) : undefined
        }
      />

      {/* Signal KPI summary — suppressed when no signals exist */}
      {signalKpis.length > 0 && (
        <AdminKpiStripPanel kpis={signalKpis} />
      )}

      <AdminUrlTabFilter
        ariaLabel="Signal status filter"
        activeKey={activeStatus}
        tabs={TABS.map((tab) => {
          const count =
            tab.value === "all"
              ? Object.values(countMap).reduce((a, b) => a + b, 0)
              : (countMap[tab.value] ?? 0);

          return {
            key: tab.value,
            label: (
              <>
                {tab.label}
                {count > 0 ? <span className="tabular">{count}</span> : null}
              </>
            ),
            href: withAdminVaultQuery("/admin/signals", vaultQuery, {
              status: tab.value,
            }),
          };
        })}
      />

      {/* Event list */}
      {events.length === 0 ? (
        <EmptySurface
          variant="widget"
          message={`No rebalance signals with status "${activeStatus}".`}
          detail="Signals for the selected vault are created automatically by the Inngest rebalancing-signal function when engine rules fire."
          className="min-h-32"
        />
      ) : (
        <section className="admin-doc-stack admin-doc-stack--relaxed">
          <p className="body-xs admin-doc-weight-semibold ct-text-body">
            {events.length} signal{events.length !== 1 ? "s" : ""}
          </p>
          {events.map((event) => (
            <RebalanceCard key={event.id} event={event} requiredSigners={2} />
          ))}
        </section>
      )}
    </>
  );
}
