import Link from "next/link";

import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { ScopeFallbackNotice } from "@/components/admin/scope-fallback-notice";
import { buildDistributionsKpiStrip } from "@/lib/admin/distributions-kpi-strip";
import { cn } from "@/lib/cn";
import { prisma } from "@/lib/db";
import { isMockTxHash, txProvenance } from "@/lib/provenance";
import {
  adminVaultHrefFromSlug,
  distributionVaultScopeWhere,
  matchesDistributionVaultScope,
  resolveFixtureVault,
} from "@/lib/vaults/dashboard-scope";
import { formatAdminDate, formatUsdDetailed } from "@/lib/vaults/product-display";
import { listAllVaults, vaultLabel, vaultSlug } from "@/lib/vaults/resolver";
import {
  EmptyState,
  Kpi,
  KpiGrid,
  ProvenanceBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { Disclaimer, PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

// D8: the retired product name stays readable in the archive, but never
// without its "retired" qualifier — the rail no longer exists.
const LEGACY_VAULT_LABELS: Record<string, string> = {
  "hearst-yield-vault": "Hearst Yield Vault (retired name)",
};

/** Display window for the history table — KPIs are NEVER derived from it. */
const HISTORY_WINDOW = 6;

export async function AdminDistributionsView({
  vaultParam,
}: {
  vaultParam?: string;
}) {
  const { vaultId, usedFallback, requested } = resolveFixtureVault(vaultParam);

  const scopeWhere = distributionVaultScopeWhere(vaultId);
  const [rawHistory, totals, allVaults] = await Promise.all([
    prisma.distribution.findMany({
      where: scopeWhere,
      orderBy: { distributedAt: "desc" },
      take: HISTORY_WINDOW,
    }),
    // TOP4 fix: KPI figures come from a windowless aggregate over the FULL
    // scoped population — the findMany window above only feeds the table.
    prisma.distribution.aggregate({
      where: scopeWhere,
      _sum: { amountUsdc: true },
      _count: true,
      _max: { recipientsCount: true },
    }),
    listAllVaults({ status: "live-or-paused" }),
  ]);

  const vaultOptions = allVaults.map((ref) => ({
    value: vaultSlug(ref),
    label: vaultLabel(ref),
  }));
  const vaultLabelBySlug = new Map(vaultOptions.map((o) => [o.value, o.label]));
  const history = rawHistory.filter((entry) =>
    matchesDistributionVaultScope(entry.vaultRef, vaultId),
  );
  const activeVaultLabel = vaultLabelBySlug.get(vaultId) ?? vaultId;

  const totalRecords = totals._count;
  const distributionKpis = buildDistributionsKpiStrip(
    {
      totalUsdc: totals._sum.amountUsdc?.toNumber() ?? 0,
      recordCount: totalRecords,
      maxRecipients: totals._max.recipientsCount,
    },
    history[0] ?? null,
  );

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Retired rail · Non-Series 1"
        title="Historical records"
        description="Read-only archive of legacy payout records — not part of the Series 1 BTC accumulation model."
      />

      {usedFallback && requested !== undefined ? (
        <ScopeFallbackNotice
          requested={requested}
          resolvedLabel={activeVaultLabel}
        />
      ) : null}

      <Section title="Series 1 — BTC accumulation">
        <Panel>
          <div
            className={cn(
              FORM_SURFACE,
              "text-sm leading-relaxed text-[var(--ct-text-muted)]",
            )}
          >
            <p>
              Series 1 accumulates BTC over a 24-month term with rule-based
              take-profit and delivers accumulated BTC at maturity. This page is
              retained only to review records created by earlier product
              configurations; no action is available here.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-[var(--ct-text-faint)]">
              <li>Three pockets: Mining Power, BTC Pouch, and a USDC reserve.</li>
              <li>
                BTC accumulation and take-profit events are recorded through the
                reserve evidence rail.
              </li>
              <li>
                Projections remain conditional on their stated assumptions and
                source provenance.
              </li>
            </ul>
          </div>
        </Panel>
      </Section>

      {distributionKpis.length > 0 ? (
        <KpiGrid>
          {distributionKpis.map((kpi) => (
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

      <Section
        title={`History (${activeVaultLabel})`}
        description="Retired records retained for audit continuity"
      >
        <Panel
          title={
            totalRecords > history.length
              ? `Last ${history.length} of ${totalRecords} records`
              : `${history.length} historical ${history.length === 1 ? "record" : "records"}`
          }
        >
          {history.length === 0 ? (
            <EmptyState
              title={`No historical records for ${activeVaultLabel}`}
              description="This retired admin archive remains available for audit continuity."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vault</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Amount (USDC)</TableHead>
                  <TableHead className="hidden text-right md:table-cell">
                    Recipients
                  </TableHead>
                  <TableHead className="text-right">Recorded at</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">
                    Tx hash
                  </TableHead>
                  <TableHead className="hidden text-right lg:table-cell">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((d) => {
                  const slug = d.vaultRef;
                  const label = slug
                    ? (LEGACY_VAULT_LABELS[slug] ??
                      vaultLabelBySlug.get(slug) ??
                      slug)
                    : null;
                  const vaultHref = slug ? adminVaultHrefFromSlug(slug) : null;

                  return (
                    <TableRow key={d.id}>
                      <TableCell className="max-w-[10rem] truncate font-medium">
                        {vaultHref && label ? (
                          <Link
                            href={vaultHref}
                            className="text-accent hover:underline"
                          >
                            {label}
                          </Link>
                        ) : label ? (
                          <span className="text-[var(--ct-text-muted)]">{label}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {d.period}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {formatUsdDetailed(d.amountUsdc.toNumber())}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums md:table-cell">
                        {d.recipientsCount}
                      </TableCell>
                      <TableCell className="text-right text-sm text-[var(--ct-text-muted)]">
                        {formatAdminDate(new Date(d.distributedAt))}
                      </TableCell>
                      <TableCell className="hidden text-right font-mono text-xs xl:table-cell">
                        {d.txHash ? (
                          isMockTxHash(d.txHash) ? (
                            <span className="text-[var(--ct-text-muted)]">simulated</span>
                          ) : (
                            `${d.txHash.slice(0, 8)}…`
                          )
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden text-right lg:table-cell">
                        {/* Canonical mapping (src/lib/provenance.ts): real hash →
                            attested, 0xMOCK fixture → simulated, none → manual. */}
                        <ProvenanceBadge source={txProvenance(d.txHash)} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>

      <Disclaimer>
        Records shown above belong to retired product configurations and are
        preserved only for audit continuity. They are not part of the Series 1
        reserve evidence rail.
      </Disclaimer>
    </PageLayout>
  );
}
