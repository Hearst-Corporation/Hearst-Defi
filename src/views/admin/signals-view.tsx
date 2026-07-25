import Link from "next/link";
import type { Prisma } from "@prisma/client";

import { ManualSignalTrigger } from "@/components/admin/manual-signal-trigger";
import { RebalanceCard } from "@/components/admin/rebalance-card";
import { requestManualSignal } from "@/app/admin/signals/actions";
import { buildSignalsKpiStrip } from "@/lib/admin/signals-kpi-strip";
import { prisma } from "@/lib/db";
import {
  resolveFixtureVault,
  withAdminVaultQuery,
} from "@/lib/vaults/dashboard-scope";
import { cn } from "@/lib/cn";
import {
  Badge,
  EmptyState,
  Kpi,
  KpiGrid,
} from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

type StatusFilter = "pending" | "approved" | "executed" | "cancelled" | "all";

const TABS: { label: string; value: StatusFilter }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Executed", value: "executed" },
  { label: "Cancelled", value: "cancelled" },
  { label: "All", value: "all" },
];

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
  if (usedFallback && requested !== undefined) {
    console.warn(
      `[vault-scope] unknown ?vault="${requested}" — showing the Series 1 flagship instead`,
    );
  }

  const vaultScope = signalVaultScopeWhere(vaultId);
  const where: Prisma.RebalanceEventWhereInput = {
    ...vaultScope,
    ...(activeStatus === "all" ? {} : { status: activeStatus }),
  };

  const [events, counts] = await Promise.all([
    prisma.rebalanceEvent.findMany({
      where,
      orderBy: { triggeredAt: "desc" },
      take: 100,
    }),
    prisma.rebalanceEvent.groupBy({
      where: vaultScope,
      by: ["status"],
      _count: { id: true },
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count.id]),
  );
  const signalKpis = buildSignalsKpiStrip(
    countMap,
    events[0]?.triggeredAt ?? null,
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

      {signalKpis.length > 0 ? (
        <KpiGrid>
          {signalKpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance="manual"
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section title="Signals">
        <Panel>
          <nav
            className="flex flex-wrap gap-2 border-b border-border-subtle p-5"
            aria-label="Signal status filter"
          >
            {TABS.map((tab) => {
              const count =
                tab.value === "all"
                  ? Object.values(countMap).reduce((a, b) => a + b, 0)
                  : (countMap[tab.value] ?? 0);
              const href = withAdminVaultQuery("/admin/signals", vaultParam ?? null, {
                status: tab.value,
              });
              const active = tab.value === activeStatus;

              return (
                <Link key={tab.value} href={href}>
                  <Badge
                    variant={active ? "accent" : "outline"}
                    className={cn("cursor-pointer gap-1.5 px-3 py-1")}
                  >
                    {tab.label}
                    {count > 0 ? (
                      <span className="tabular-nums">({count})</span>
                    ) : null}
                  </Badge>
                </Link>
              );
            })}
          </nav>

          <div className="p-5">
            {events.length === 0 ? (
              <EmptyState
                title={`No rebalance signals with status "${activeStatus}"`}
                description="Signals are created automatically when engine rules fire."
              />
            ) : (
              <div className="space-y-5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
                  {events.length} signal{events.length !== 1 ? "s" : ""}
                </p>
                {events.map((event) => (
                  <RebalanceCard
                    key={event.id}
                    event={event}
                    requiredSigners={2}
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
