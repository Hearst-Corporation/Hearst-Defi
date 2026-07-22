/**
 * /vaults/[vaultId] — Series 1 vault detail.
 *
 * Rebuilt off the legacy `InvestFlowShell` + `TermSheetPreview` pair: the term
 * sheet led with "Est. yield range {apyLow}–{apyHigh}%" read straight off the
 * DB columns, which is retired v1 framing. Series 1 pays no rate and makes no
 * periodic distribution, so this page carries structure, allocation, on-chain
 * state and maturity terms — and no rate tile at all.
 *
 * Identity resolves through `@/lib/vaults/series1` (never `vault.name` /
 * `vault.strategy`). The on-chain readout is kept as-is: it is honest by
 * construction and reports the READ, not the config.
 */
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";
import { VaultChainReadout } from "@/components/vaults/vault-chain-readout";
import { getVault } from "@/lib/data/vaults";
import { REG_LABELS_LONG, SPV_LABELS_LONG } from "@/lib/constants/vault";
import { investDepositPath, INVEST_SELECT_PATH } from "@/lib/vaults/invest-routes";
import {
  SERIES1_DESCRIPTION,
  SERIES1_DISCLAIMER,
  SERIES1_FULL_NAME,
  SERIES1_NO_RATE_NOTE,
  formatBps,
  series1IsOpen,
  series1SafeDisclaimer,
  series1StatusLabel,
  series1TargetPockets,
} from "@/lib/vaults/series1";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Vault details · ${SERIES1_FULL_NAME}`,
  description: SERIES1_DESCRIPTION,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

function formatUsdc(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/70 px-5 py-4 dark:border-white/10">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
      {meta ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
    </div>
  );
}

function PanelRow({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-950 dark:text-white">{label}</p>
        {hint ? <p className="mt-0.5 text-xs leading-5 text-zinc-500 dark:text-zinc-400">{hint}</p> : null}
      </div>
      <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-950 dark:text-white">{value}</p>
    </div>
  );
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const vault = await getVault(id);

  if (!vault) notFound();

  const open = series1IsOpen(vault.status);
  const pockets = series1TargetPockets(vault);
  // `currentAumUsdc` is null when no snapshot attributes an AUM to this vault
  // (Phase 3 has not landed a per-vault snapshot link). Null and 0 both render
  // as absent here, but they are different facts and only null is "unknown".
  const aum =
    vault.currentAumUsdc !== null && vault.currentAumUsdc > 0 ? vault.currentAumUsdc : null;
  // The stored disclaimer still describes the retired yield product on legacy
  // rows — suppressed unless it is clean (see series1SafeDisclaimer).
  const safeDisclaimer = series1SafeDisclaimer(vault.disclaimers);
  const spv = SPV_LABELS_LONG[vault.spvJurisdiction] ?? vault.spvJurisdiction ?? "—";
  const reg = REG_LABELS_LONG[vault.regExemption] ?? vault.regExemption ?? "—";

  return (
    <div data-testid="vault-detail-page" className="flex flex-col gap-10">
      <KycPageTitle
        title={SERIES1_FULL_NAME}
        meta={`${vault.ticker} · Methodology v3.0`}
        description={SERIES1_DESCRIPTION}
        actions={
          open ? (
            <Link
              href={investDepositPath(vault.id)}
              className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              Continue to subscription
            </Link>
          ) : (
            <Link
              href={INVEST_SELECT_PATH}
              className="inline-flex min-h-10 items-center rounded-lg border border-zinc-300 px-4 text-sm font-medium text-zinc-800 hover:bg-zinc-100 dark:border-white/15 dark:text-zinc-100 dark:hover:bg-white/5"
            >
              Back to vault overview
            </Link>
          )
        }
      />

      <KycSection>
        <KycHeroKpiBand
          hero={{
            label: "Vault status",
            value: open ? "Open" : series1StatusLabel(vault.status),
            hint: open
              ? "Active · Permissioned — no funds move until you confirm a subscription."
              : "Subscriptions are not open at this time.",
          }}
          metrics={[
            { label: "Term", value: "24 months", hint: "BTC delivered at maturity" },
            {
              label: "Minimum ticket",
              value: formatUsdc(vault.minTicketUsdc),
              hint: "USDC · contractual",
            },
            {
              label: "Soft lock-up",
              value: `${vault.softLockupDays} days`,
              hint: "Contractual — not enforced on-chain",
            },
            { label: "Capital deployed", value: formatUsdc(aum), hint: "Snapshot aggregate" },
            {
              label: "Capacity",
              value: formatUsdc(vault.capacityUsdc),
              hint: "Series 1 hard cap",
            },
            { label: "Capital structure", value: "Equity only", hint: "Built from mining production only" },
          ]}
        />
      </KycSection>

      {/* ON-CHAIN STATE — what the contract actually returns, next to the
          database aggregate. The gap between them IS the information. */}
      <KycSection
        index="01"
        title="On-chain state"
        description="What the vault contract returns right now, alongside the recorded snapshot aggregate."
      >
        <VaultChainReadout dbAumUsdc={vault.currentAumUsdc} />
      </KycSection>

      <KycSection
        index="02"
        title="Allocation"
        description="The three on-chain pockets capital is structured across. Product target split — the realised on-chain split is not yet indexed per vault."
      >
        <KycPanel>
          <div className="divide-y divide-zinc-200/70 dark:divide-white/10">
            {pockets.map((pocket) => (
              <PanelRow
                key={pocket.code}
                label={`${pocket.code} · ${pocket.label}`}
                hint={pocket.role}
                value={formatBps(pocket.targetBps)}
              />
            ))}
          </div>
        </KycPanel>
      </KycSection>

      <KycSection index="03" title="Structure & delivery">
        <div className="grid gap-5 lg:grid-cols-2">
          <KycPanel>
            <PanelHeader title="Share receipt & structure" />
            <div className="divide-y divide-zinc-200/70 dark:divide-white/10">
              <PanelRow label="Share class" value={vault.shareClass || "—"} />
              <PanelRow label="SPV" value={spv} />
              <PanelRow label="Exemption" value={reg} />
              <PanelRow
                label="Management / performance"
                value={`${(vault.fees.mgmtBps / 100).toFixed(2)}% / ${(vault.fees.perfBps / 100).toFixed(2)}%`}
                hint={`Hurdle ${(vault.fees.hurdleBps / 100).toFixed(2)}%`}
              />
            </div>
          </KycPanel>

          <KycPanel>
            <PanelHeader title="Maturity & BTC delivery" />
            <div className="divide-y divide-zinc-200/70 dark:divide-white/10">
              <PanelRow label="Term" value="24 months" hint="From subscription settlement" />
              <PanelRow
                label="Delivered in"
                value="BTC"
                hint="The accumulated reserve, transferred at maturity"
              />
              <PanelRow
                label="Periodic distribution"
                value="None"
                hint="No periodic cash and no fixed rate at any point in the term"
              />
              <PanelRow
                label="Proof status"
                value="Proof Center"
                hint="Attestations and on-chain evidence"
              />
            </div>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection>
        <div className="flex flex-col gap-2">
          <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {SERIES1_NO_RATE_NOTE}
          </p>
          {safeDisclaimer ? (
            <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {safeDisclaimer}
            </p>
          ) : null}
          <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {SERIES1_DISCLAIMER}
          </p>
        </div>
      </KycSection>
    </div>
  );
}
