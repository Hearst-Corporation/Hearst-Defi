// Vault — held-positions index (Visual Direction 2026, Archive 4 · Workstream A/C).
//
// The "Vault" rail entry lands here: only the vaults the investor already holds.
// Each row opens the per-position detail (/portfolio/[positionId], the Vault
// Details page). Bound to REAL data (loadPortfolio) — honest empty state when
// there are no positions, no fabricated affordances. v2 note-of-mining model:
// each position ACCUMULATES BTC over its term — there is NO periodic cash
// distribution, so the index shows accrued value, never a "next distribution".

import Link from "next/link";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { cockpitButtonVariants } from "@/components/catalyst/cockpit-button";
import { ProvenanceBadge } from "@/components/catalyst/provenance-badge";
import { loadPortfolio } from "@/lib/data/portfolio";
import { formatUsdFull } from "@/lib/vaults/product-display";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vault",
  description: "The vaults you hold — performance, lock progress and accrued BTC.",
};

const TABLE_HEAD = "bg-transparent ct-bento-label";
const ROW =
  "border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_5%,transparent)]";

export default async function MyVaultsPage() {
  const { positions } = await loadPortfolio();
  const hasPositions = positions.length > 0;

  return (
    <div className="dark relative mb-8 flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page">
      <div className="relative z-10 flex flex-col gap-y-5 p-5 lg:p-6">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--ct-border-soft)] pb-3">
          <div className="flex flex-col gap-1.5">
            <span className="ct-bento-label">Your deployed capital</span>
            <h1 className="h1 shrink-0">
              Your <span className="h1-accent">Vaults</span>
            </h1>
          </div>
          <Link
            href="/vaults"
            className={cn(cockpitButtonVariants({ variant: "primary", size: "sm" }), "shrink-0")}
          >
            Invest in a vault →
          </Link>
        </div>

        {hasPositions ? (
          <section
            className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-surface-card"
            aria-label="Held vaults"
          >
            <Table
              dense
              className="[--gutter:0px] max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
            >
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>Vault</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>Deposited</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>Current Value</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} text-right`}>Accrued value</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>Actions</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((p, i) => {
                  const perfPct =
                    p.principalUsdc > 0
                      ? ((p.valueUsdc - p.principalUsdc) / p.principalUsdc) * 100
                      : 0;
                  const up = perfPct >= 0;
                  return (
                    <TableRow key={p.id} href={`/portfolio/${p.id}`} className={ROW}>
                      <TableCell className="pl-5">
                        <div className="flex items-center gap-3">
                          <div
                            aria-hidden="true"
                            className="h-7 w-1 shrink-0 rounded-full bg-[var(--ct-accent)]"
                          />
                          <span className="ct-metric-value min-w-0 truncate">
                            {p.vaultName ?? `Vault ${i + 1}`}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-baseline justify-end gap-2">
                          <span className="ct-metric-value">{formatUsdFull(p.principalUsdc)}</span>
                          <ProvenanceBadge kind="estimated" variant="strip" />
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-baseline justify-end gap-2">
                          <span className="ct-metric-value">{formatUsdFull(p.valueUsdc)}</span>
                          <span
                            className="ct-metric-caption tabular-nums"
                            style={{
                              color: up
                                ? "var(--ct-status-success)"
                                : "var(--ct-text-muted)",
                            }}
                          >
                            {up ? "+" : ""}
                            {perfPct.toFixed(1)}%
                          </span>
                          <ProvenanceBadge kind="estimated" variant="strip" />
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex items-baseline justify-end gap-2">
                          <span className="ct-metric-value">{formatUsdFull(p.accruedYieldUsdc)}</span>
                          <ProvenanceBadge kind="estimated" variant="strip" />
                        </span>
                      </TableCell>
                      <TableCell className="pr-5 text-right">
                        <span aria-hidden="true" className="ct-text-muted">→</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </section>
        ) : (
          <EmptySurface
            variant="widget"
            message="No vaults yet"
            detail="Once you subscribe to a vault, your deployed capital, accrued BTC and lock progress appear here."
            link={{ href: "/vaults", label: "Explore vaults to invest →" }}
            ariaLabel="No held vaults"
          />
        )}
      </div>
    </div>
  );
}
