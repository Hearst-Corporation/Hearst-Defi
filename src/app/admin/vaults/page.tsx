import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { VaultActionButton } from "@/components/admin/vault-action-button";
import { ApyRange } from "@/components/ui/apy-range";
import { Button } from "@/components/ui/button";
import { EmptySurface } from "@/components/ui/empty-surface";
import { Progress } from "@/components/ui/progress";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { STRATEGY_LABELS } from "@/lib/constants/vault";
import { formatUsdCompact } from "@/lib/vaults/product-display";

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
        description="Review deployment status, capacity usage, target yield ranges, and operator actions across vaults."
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
              className={cn("ct-pill", isActive && "accent")}
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
          ariaLabel="Vault deployments awaiting creation"
        >
          <Link
            href="/admin/vaults/new"
            className="body-xs ct-text-muted hover:ct-text-primary transition-colors underline underline-offset-2 decoration-(--ct-border) mt-1"
          >
            Create the first one
          </Link>
        </EmptySurface>
      ) : (
        <section aria-label="Vault deployments" className="admin-vaults-list">
          {/* Column headers */}
          <div className="admin-vaults-list__header" aria-hidden>
            <span className="stat-label">Vault</span>
            <span className="stat-label">Status</span>
            <span className="stat-label">AUM vs Capacity</span>
            <span className="stat-label">Target APY</span>
            <span className="stat-label sr-only">Actions</span>
          </div>

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
              <div
                key={vault.id}
                className="admin-vaults-list__row"
                aria-label={`${vault.ticker} deployment`}
              >
                {/* Identity */}
                <div className="admin-vaults-list__identity">
                  <span className="mono tabular body-sm font-semibold ct-text-strong">
                    {vault.ticker}
                  </span>
                  <span className="body-xs ct-text-muted truncate">
                    {vault.name}
                  </span>
                  <span className="body-xs ct-text-faint">
                    {STRATEGY_LABELS[vault.strategy] ?? vault.strategy}
                  </span>
                </div>

                {/* Status */}
                <div className="admin-vaults-list__status">
                  <span
                    role="img"
                    aria-label={statusDisplay.label}
                    className={cn(
                      "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                      statusDisplay.dotClass,
                    )}
                  />
                  <span className="body-xs ct-text-muted">{statusDisplay.label}</span>
                </div>

                {/* AUM vs Capacity */}
                <div className="admin-vaults-list__metrics">
                  <div className="flex items-center gap-2">
                    <Progress
                      value={aumPct}
                      label={`AUM vs capacity for ${vault.ticker}`}
                      variant="plain"
                      className="h-1 flex-1"
                    />
                    <ProvenanceBadge
                      kind={aumUsdc > 0 ? "live" : "estimated"}
                      variant="strip"
                    />
                  </div>
                  <span className="mono tabular body-xs ct-text-muted">
                    {formatUsdCompact(aumUsdc)} / {formatUsdCompact(capacityUsdc)}
                  </span>
                </div>

                {/* Target APY */}
                <div className="admin-vaults-list__apy">
                  <div className="flex items-center gap-1.5">
                    <ApyRange low={apyLow} high={apyHigh} precision={1} />
                    <ProvenanceBadge kind="estimated" variant="strip" />
                  </div>
                </div>

                {/* Actions */}
                <div className="admin-vaults-list__actions">
                  <Button variant="ghost" size="md" asChild>
                    <Link href={`/admin/vaults/${vault.id}`}>View</Link>
                  </Button>
                  <Button variant="ghost" size="md" asChild>
                    <Link href={`/admin/vaults/new?cloneFrom=${encodeURIComponent(vault.ticker)}`}>
                      Clone
                    </Link>
                  </Button>
                  {vault.status === "live" && (
                    <VaultActionButton
                      label="Pause"
                      variant="ghost"
                      size="md"
                      confirm={{
                        title: "Pause this vault?",
                        description:
                          "New activity for this vault will be paused. Existing investor records remain unchanged.",
                        confirmLabel: "Pause vault",
                        confirmVariant: "danger",
                      }}
                      action={async () => {
                        "use server";
                        await pauseVault(vault.id);
                      }}
                    />
                  )}
                  {vault.status === "paused" && (
                    <VaultActionButton
                      label="Resume"
                      variant="ghost"
                      size="md"
                      confirm={{
                        title: "Resume this vault?",
                        description:
                          "This will make the vault available again according to its configured status and permissions.",
                        confirmLabel: "Resume vault",
                        confirmVariant: "primary",
                      }}
                      action={async () => {
                        "use server";
                        await resumeVault(vault.id);
                      }}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
