import type { Prisma } from "@prisma/client";

import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { AdminUrlTabFilter } from "@/components/admin/admin-url-tab-filter";
import { ManualSignalTrigger } from "@/components/admin/manual-signal-trigger";
import { RebalanceCard } from "@/components/admin/rebalance-card";
import { ScopeFallbackNotice } from "@/components/admin/scope-fallback-notice";
import { requestManualSignal } from "@/app/admin/signals/actions";
import { buildSignalsKpiStrip } from "@/lib/admin/signals-kpi-strip";
import { prisma } from "@/lib/db";
import {
  getVaultFullLabel,
  resolveFixtureVault,
  withAdminVaultQuery,
} from "@/lib/vaults/dashboard-scope";
import { EmptyState, Kpi, KpiGrid } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

type StatusFilter = "pending" | "approved" | "executed" | "cancelled" | "all";

const TABS: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Executed", value: "executed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

/** Display cap of the signals list — the copy states "Showing X of Y" when
 *  the scope holds more rows than this. */
const SIGNALS_DISPLAY_CAP = 100;

function signalVaultScopeWhere(vaultId: string): Prisma.RebalanceEventWhereInput {
  return vaultId === "yield"
    ? { OR: [{ vaultRef: "yield" }, { vaultRef: null }] }
    : { vaultRef: vaultId };
}

export async function AdminSignalsView({
  statusParam,
  vaultParam,
}: {
  statusParam?: string;
  vaultParam?: string;
}) {
  const activeStatus: StatusFilter =
    typeof statusParam === "string" &&
    TABS.some((t) => t.value === statusParam)
      ? (statusParam as StatusFilter)
      : "pending";

  const { vaultId, usedFallback, requested } = resolveFixtureVault(vaultParam);

  const vaultScope = signalVaultScopeWhere(vaultId);
  const where: Prisma.RebalanceEventWhereInput = {
    ...vaultScope,
    ...(activeStatus === "all" ? {} : { status: activeStatus }),
  };

  const [events, counts, mostRecent] = await Promise.all([
    prisma.rebalanceEvent.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      take: SIGNALS_DISPLAY_CAP,
    }),
    prisma.rebalanceEvent.groupBy({
      where: vaultScope,
      by: ["status"],
      _count: { id: true },
    }),
    // True most-recent signal of the WHOLE vault scope — independent of the
    // status filter and of the display cap (the first row of a filtered page
    // is not "the most recent").
    prisma.rebalanceEvent.findFirst({
      where: vaultScope,
      orderBy: { triggeredAt: "desc" },
      select: { triggeredAt: true },
    }),
  ]);

  // requiredSigners is a REAL column (VaultDeployment.requiredSigners) — join
  // it through vaultRef. A ref that resolves to no deployment (fixture ids,
  // legacy null refs) yields null → the card says "quorum unavailable",
  // never a hardcoded 2.
  const deploymentRefs = [
    ...new Set(
      events
        .map((event) => event.vaultRef)
        .filter((ref): ref is string => ref !== null),
    ),
  ];
  const deployments =
    deploymentRefs.length > 0
      ? await prisma.vaultDeployment.findMany({
          where: { id: { in: deploymentRefs } },
          select: { id: true, requiredSigners: true },
        })
      : [];
  const quorumByRef = new Map(
    deployments.map((d) => [d.id, d.requiredSigners]),
  );

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count.id]),
  );
  const totalInScope = counts.reduce((sum, c) => sum + c._count.id, 0);
  const totalForTab =
    activeStatus === "all" ? totalInScope : (countMap[activeStatus] ?? 0);

  const signalKpis = buildSignalsKpiStrip(
    countMap,
    mostRecent?.triggeredAt ?? null,
  );
  const isDev = process.env.NODE_ENV === "development";

  const manualSignalAction = async (
    ruleId: string,
    scopeVaultId?: string,
  ): Promise<string> => {
    "use server";
    return requestManualSignal(ruleId, scopeVaultId);
  };

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Vaults"
        title="Vault rebalancing"
        description="Rebalance signals for the selected vault scope."
        actions={
          isDev ? (
            <ManualSignalTrigger
              action={manualSignalAction}
              vaultId={vaultId}
            />
          ) : undefined
        }
      />

      {usedFallback && requested !== undefined ? (
        <ScopeFallbackNotice
          requested={requested}
          resolvedLabel={getVaultFullLabel(vaultId)}
        />
      ) : null}

      {signalKpis.length > 0 ? (
        <KpiGrid>
          {signalKpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Signals">
        <Panel>
          <AdminUrlTabFilter
            className="border-b border-[var(--ct-border)] p-5"
            ariaLabel="Signal status filter"
            activeKey={activeStatus}
            tabs={TABS.map((tab) => ({
              key: tab.value,
              label: tab.label,
              href: withAdminVaultQuery("/admin/signals", vaultParam ?? null, {
                status: tab.value,
              }),
              count:
                tab.value === "all" ? totalInScope : (countMap[tab.value] ?? 0),
            }))}
          />

          <div className={FORM_SURFACE}>
            {events.length === 0 ? (
              <EmptyState
                title={`No rebalance signals with status "${activeStatus}"`}
                description="Signals are created automatically when engine rules fire."
              />
            ) : (
              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--ct-text-faint)]">
                  {totalForTab > events.length
                    ? `Showing ${events.length} of ${totalForTab} signals (display cap ${SIGNALS_DISPLAY_CAP})`
                    : `${events.length} signal${events.length !== 1 ? "s" : ""}`}
                </p>
                {events.map((event) => (
                  <RebalanceCard
                    key={event.id}
                    event={event}
                    requiredSigners={
                      event.vaultRef !== null
                        ? (quorumByRef.get(event.vaultRef) ?? null)
                        : null
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
