import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
import { formatUsdFull } from "@/lib/vaults/product-display";

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

type VaultStatus =
  | "draft"
  | "review"
  | "deployed"
  | "live"
  | "paused"
  | "closed";

const VAULT_STATUS_DISPLAY: Record<
  VaultStatus,
  { label: string; dotClass: string }
> = {
  draft: { label: "Draft", dotClass: "bg-(--ct-text-muted)" },
  review: { label: "Review", dotClass: "ct-status-dot-warning" },
  deployed: { label: "Deployed", dotClass: "bg-(--ct-text-strong)" },
  live: { label: "Live", dotClass: "ct-status-dot-success" },
  paused: { label: "Paused", dotClass: "ct-status-dot-warning" },
  closed: { label: "Closed", dotClass: "ct-status-dot-danger" },
};

function vaultStatusDisplay(status: string) {
  return (
    VAULT_STATUS_DISPLAY[status as VaultStatus] ?? {
      label: status,
      dotClass: "bg-(--ct-text-muted)",
    }
  );
}

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
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Vaults"
        actions={
          <Button variant="primary" asChild size="md">
            <Link href="/admin/vaults/new">+ New deployment</Link>
          </Button>
        }
      />

      {/* Filter tabs */}
      <div className="admin-doc-inline-row" role="tablist" aria-label="Filter vaults by status">
        {FILTER_TABS.map((tab) => {
          const isActive = tab.key === activeFilter;
          return (
            <Link
              key={tab.key}
              href={tab.key === "all" ? "/admin/vaults" : `/admin/vaults?filter=${tab.key}`}
              role="tab"
              aria-selected={isActive}
              className={cn(
                "ct-pill",
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
        <Card aria-label="No vault deployments" hoverOverlay={false}>
          <EmptySurface
            variant="inline"
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
        </Card>
      ) : (
        <section aria-label="Vault deployments" className="admin-doc-stack admin-doc-stack--list">
          {vaults.map((vault) => {
            const aumUsdc = vault.positions.reduce(
              (sum, p) => sum + Number(p.principalUsdc),
              0,
            );
            const capacityUsdc = Number(vault.capacityUsdc);
            const aumPct = capacityUsdc > 0 ? (aumUsdc / capacityUsdc) * 100 : 0;
            const apyLow = Number(vault.targetApyLowBps) / 100;
            const apyHigh = Number(vault.targetApyHighBps) / 100;
            const statusDisplay = vaultStatusDisplay(vault.status);

            return (
              <Card
                key={vault.id}
                density="compact"
                aria-label={`${vault.ticker} deployment`}
              >
                <div className="admin-doc-stack admin-doc-stack--actions">
                  <div className="admin-doc-inline-row admin-doc-inline-row--between admin-doc-inline-row--start">
                    <div className="admin-doc-stack admin-doc-stack--dense min-w-0">
                      <div className="admin-doc-inline-row admin-doc-inline-row--loose">
                        <span className="mono tabular body-sm font-semibold ct-text-strong">
                          {vault.ticker}
                        </span>
                        <span className="admin-doc-inline-row admin-doc-inline-row--actions shrink-0">
                          <span
                            role="img"
                            aria-label={statusDisplay.label}
                            className={cn(
                              "inline-block h-2 w-2 shrink-0 rounded-full",
                              statusDisplay.dotClass,
                            )}
                          />
                          <span className="body-xs ct-text-muted">
                            {statusDisplay.label}
                          </span>
                        </span>
                      </div>
                      <p className="body-sm ct-text-muted truncate max-w-xs">
                        {vault.name}
                      </p>
                      <p className="body-xs ct-text-faint">
                        {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                      </p>
                    </div>

                    <div className="admin-doc-inline-row admin-doc-inline-row--actions shrink-0">
                      <Button variant="ghost" size="md" asChild>
                        <Link href={`/admin/vaults/${vault.id}`}>View</Link>
                      </Button>

                      <Button variant="ghost" size="md" asChild>
                        <Link
                          href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}
                        >
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
                          <Button variant="secondary" size="md" type="submit">
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
                          <Button variant="secondary" size="md" type="submit">
                            Resume
                          </Button>
                        </form>
                      )}
                    </div>
                  </div>

                  <div className="admin-doc-kpi-grid-2">
                    <div className="admin-doc-stack admin-doc-stack--compact min-w-0">
                      <div className="admin-doc-inline-row admin-doc-inline-row--between">
                        <span className="stat-label">AUM vs Capacity</span>
                        <ProvenanceBadge
                          kind={aumUsdc > 0 ? "live" : "estimated"}
                          variant="strip"
                        />
                      </div>
                      <Progress
                        value={aumPct}
                        label="AUM vs capacity"
                        variant="plain"
                        className="h-1"
                      />
                      <span className="mono tabular body-xs ct-text-muted">
                        {formatUsdFull(aumUsdc)} / {formatUsdFull(capacityUsdc)}
                      </span>
                    </div>

                    <div className="admin-doc-stack admin-doc-stack--compact min-w-0">
                      <div className="admin-doc-inline-row admin-doc-inline-row--between">
                        <span className="stat-label">Target APY</span>
                        <ProvenanceBadge kind="estimated" variant="strip" />
                      </div>
                      <ApyRange low={apyLow} high={apyHigh} precision={1} />
                      <span className="body-xs ct-text-faint">Not guaranteed</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}
