import Link from "next/link";

import { prisma } from "@/lib/db";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminKpiStripPanel } from "@/components/admin/dashboard/admin-kpi-strip-panel";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { BentoPanel } from "@/components/ui/bento";
import { EmptySurface } from "@/components/ui/empty-surface";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import {
  distributionVaultScopeWhere,
  matchesDistributionVaultScope,
  resolveFixtureVaultId,
} from "@/lib/vaults/dashboard-scope";
import { formatAdminDate, formatUsdDetailed } from "@/lib/vaults/product-display";
import { listAllVaults, vaultSlug, vaultLabel } from "@/lib/vaults/resolver";
import { buildDistributionsKpiStrip } from "@/lib/admin/distributions-kpi-strip";
import { DistributionForm } from "./distribution-form";

export const dynamic = "force-dynamic";

interface DistributionsPageProps {
  searchParams: Promise<{ vault?: string }>;
}

const LEGACY_VAULT_LABELS: Record<string, string> = {
  "hearst-yield-vault": "Hearst Yield Vault",
};

export default async function DistributionsPage({
  searchParams,
}: DistributionsPageProps) {
  const params = await searchParams;
  const vaultId = resolveFixtureVaultId(params.vault);

  const [rawHistory, allVaults] = await Promise.all([
    prisma.distribution.findMany({
      where: distributionVaultScopeWhere(vaultId),
      orderBy: { distributedAt: "desc" },
      take: 6,
    }),
    listAllVaults({ status: "live-or-paused" }),
  ]);

  // Build a map vaultRef (slug) → label for quick lookup in the history table.
  const vaultOptions = allVaults.map((ref) => ({
    value: vaultSlug(ref),
    label: vaultLabel(ref),
  }));

  // For the history table we also need a slug → label map.
  const vaultLabelBySlug = new Map<string, string>(
    vaultOptions.map((o) => [o.value, o.label]),
  );
  const history = rawHistory.filter((entry) =>
    matchesDistributionVaultScope(entry.vaultRef, vaultId),
  );
  const activeVaultLabel = vaultLabelBySlug.get(vaultId) ?? vaultId;
  const distributionKpis = buildDistributionsKpiStrip(history);

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Vault"
          titleAccent="Distributions"
          contextLabel="Vaults"
        />

        {/* Distribution KPI summary — suppressed when no history */}
        {distributionKpis.length > 0 && (
          <AdminKpiStripPanel kpis={distributionKpis} />
        )}

        {/* Compute + confirm form (client) */}
        <DistributionForm vaultOptions={vaultOptions} initialVault={vaultId} />

        {/* Distribution history */}
        <section className="flex flex-col gap-4">
          <h2 className="text-[15px] font-semibold tracking-tight text-white">
            History ({activeVaultLabel})
          </h2>

          {history.length === 0 ? (
            <EmptySurface
              variant="widget"
              message={`No distributions yet for ${activeVaultLabel}.`}
              detail="Confirmed distributions for this vault will appear here after multisig approval."
              className="min-h-32"
            />
          ) : (
          <AdminTable
            data={history}
            headers={[
              "Vault",
              "Period",
              <span key="amount" className="text-right">Amount (USDC)</span>,
              <span key="recipients" className="hidden md:inline text-right">Recipients</span>,
              <span key="distributed" className="text-right">Distributed at</span>,
              <span key="tx" className="hidden xl:inline text-right">Tx hash</span>,
              <span key="source" className="hidden lg:inline text-right">Source</span>,
            ]}
            colWidths={[
              "w-[28%]",
              "w-[16%]",
              "w-[22%] text-right",
              "hidden w-[12%] text-right md:table-cell",
              "w-[34%] text-right md:w-[22%]",
              "hidden text-right xl:table-cell",
              "hidden text-right lg:table-cell",
            ]}
            renderRow={(d) => {
              const slug = d.vaultRef;
              const label = slug
                ? (LEGACY_VAULT_LABELS[slug] ?? vaultLabelBySlug.get(slug) ?? slug)
                : null;

              const vaultHref = slug
                ? slug === "yield" || slug === "defensive" || slug === "btc-plus"
                  ? `/admin/dashboard${slug !== "yield" ? `?vault=${slug}` : ""}`
                  : `/admin/vaults/${slug}`
                : null;

              return (
                <>
                  <td className="truncate px-5 py-4 align-top text-[13px] text-zinc-300">
                    {vaultHref && label ? (
                      <Link
                        href={vaultHref}
                        className="block max-w-full truncate text-[#A7FB90] hover:underline"
                      >
                        {label}
                      </Link>
                    ) : label ? (
                      <span className="text-zinc-400">{label}</span>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4 align-top font-mono text-[12px] text-zinc-300">
                    {d.period}
                  </td>
                  <td className="px-5 py-4 text-right align-top font-medium tabular-nums text-white">
                    {formatUsdDetailed(d.amountUsdc.toNumber())}
                  </td>
                  <td className="hidden px-5 py-4 text-right align-top tabular-nums text-zinc-400 md:table-cell">
                    {d.recipientsCount}
                  </td>
                  <td className="px-5 py-4 text-right align-top text-zinc-400">
                    {formatAdminDate(new Date(d.distributedAt))}
                  </td>
                  <td className="hidden px-5 py-4 text-right align-top font-mono text-[12px] text-zinc-600 xl:table-cell">
                    {d.txHash ? (
                      d.txHash.startsWith("0xMOCK") ? (
                        <span className="text-zinc-600">simulated</span>
                      ) : (
                        `${d.txHash.slice(0, 8)}…`
                      )
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </td>
                  <td className="hidden px-5 py-4 text-right align-top lg:table-cell">
                    <span className="inline-flex justify-end">
                      <ProvenanceBadge
                        variant="strip"
                        kind={
                          d.txHash
                            ? d.txHash.startsWith("0xMOCK")
                              ? "estimated"
                              : "attested"
                            : "manual"
                        }
                      />
                    </span>
                  </td>
                </>
              );
            }}
          />
          )}

          <BentoPanel>
            <div className="flex flex-col gap-2 p-5">
              <h3 className="text-[13px] font-semibold text-white">
                Historical record
              </h3>
              <p className="max-w-prose text-[12px] text-zinc-600">
                Distributions shown above are historical records only. They are
                not a commitment to any future distribution. Past distributions
                are not a reliable indicator of future performance or yield.
              </p>
            </div>
          </BentoPanel>
        </section>
      </div>
    </div>
  );
}
