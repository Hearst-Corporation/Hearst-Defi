import Link from "next/link";

import { VaultStatusPill } from "@/components/admin/vault-status-pill";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { AdminPageHeader } from "@/components/admin/admin-page-header";

import { pauseVault, resumeVault } from "./actions";

export const dynamic = "force-dynamic";

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "review", label: "Review" },
  { key: "live", label: "Live" },
  { key: "paused", label: "Paused" },
  { key: "closed", label: "Closed" },
] as const;

type FilterKey = (typeof FILTER_TABS)[number]["key"];

function isFilterKey(v: unknown): v is FilterKey {
  return FILTER_TABS.some((t) => t.key === v);
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VaultsPage({ searchParams }: PageProps) {
  await requireAdmin();

  const params = await searchParams;
  const rawFilter = params["filter"];
  const activeFilter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "all";

  const vaults = await prisma.vaultDeployment.findMany({
    where: activeFilter === "all" ? {} : { status: activeFilter },
    orderBy: { updatedAt: "desc" },
    include: {
      positions: {
        where: { status: "active" },
        select: { principalUsdc: true },
      },
    },
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="Vaults"
        actions={
          <Button variant="primary" asChild size="md">
            <Link href="/admin/vaults/new">+ New deployment</Link>
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter vaults by status">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/admin/vaults" : `/admin/vaults?filter=${tab.key}`}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "ct-pill text-xs font-semibold uppercase",
                isActive && "accent",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* List */}
      {vaults.length === 0 ? (
        <EmptySurface
          variant="widget"
          message="No deployments found."
          detail="Vault deployments will appear here once created."
          className="min-h-32"
        >
          <Link
            href="/admin/vaults/new"
            className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-(--ct-border) mt-1"
          >
            Create the first one
          </Link>
        </EmptySurface>
      ) : (
        <div className="space-y-3">
          {vaults.map((vault) => {
            const aumUsdc = vault.positions.reduce(
              (sum, p) => sum + Number(p.principalUsdc),
              0,
            );
            const capacityUsdc = Number(vault.capacityUsdc);
            const aumPct = capacityUsdc > 0 ? (aumUsdc / capacityUsdc) * 100 : 0;
            const apyLow = Number(vault.targetApyLowBps) / 100;
            const apyHigh = Number(vault.targetApyHighBps) / 100;

            return (
              <Card key={vault.id}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  {/* Identity */}
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-3">
                        <span className="mono tabular text-sm font-semibold ct-text-strong">
                          {vault.ticker}
                        </span>
                        <VaultStatusPill status={vault.status} />
                      </div>
                      <p className="body-sm ct-text-muted truncate max-w-xs">
                        {vault.name}
                      </p>
                      <p className="body-xs ct-text-faint">
                        {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                      </p>
                    </div>
                  </div>

                  {/* AUM progress */}
                  <div className="flex flex-col gap-1 min-w-36">
                    <div className="flex items-center justify-between gap-2">
                      <span className="stat-label">AUM vs Capacity</span>
                      <ProvenanceBadge kind={aumUsdc > 0 ? "live" : "estimated"} />
                    </div>
                    <Progress value={aumPct} label="AUM vs capacity" />
                    <span className="mono tabular text-xs ct-text-muted">
                      ${aumUsdc.toLocaleString()} / ${capacityUsdc.toLocaleString()}
                    </span>
                  </div>

                  {/* APY */}
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="stat-label">Target APY</span>
                      <ProvenanceBadge kind="estimated" />
                    </div>
                    <ApyRange low={apyLow} high={apyHigh} precision={1} />
                    <span className="body-xs ct-text-faint">Not guaranteed</span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/vaults/${vault.id}`}>View</Link>
                    </Button>

                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}>
                        Clone
                      </Link>
                    </Button>

                    {vault.status === "live" && (
                      <form
                        action={async () => {
                          "use server";
                          await pauseVault(vault.id);
                        }}
                      >
                        <Button variant="secondary" size="sm" type="submit">
                          Pause
                        </Button>
                      </form>
                    )}

                    {vault.status === "paused" && (
                      <form
                        action={async () => {
                          "use server";
                          await resumeVault(vault.id);
                        }}
                      >
                        <Button variant="secondary" size="sm" type="submit">
                          Resume
                        </Button>
                      </form>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
