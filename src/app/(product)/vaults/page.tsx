/**
 * /vaults — the Series 1 reserve vault cockpit.
 *
 * This replaced the legacy "Select a Product" investment flow. Series 1 is a
 * SINGLE product: there is nothing to select, so the page is a product cockpit
 * (identity → KPI band → allocation → construction path → contract → maturity)
 * rather than a catalogue.
 *
 * Naming, status and allocation resolve through `@/lib/vaults/series1`, never
 * off the raw `VaultDeployment` columns — those still carry the retired
 * yield-vault name, strategy label and APY range (see that module's header).
 *
 * Honesty contract: pocket splits are the product TARGET (the realised split is
 * not indexed on-chain per vault yet) and are labelled as such; a vault with no
 * verified deployment renders an honest empty state instead of a placeholder.
 */
import Link from "next/link";

import {
  KycEmptyChart,
  KycHeroKpiBand,
  KycPageTitle,
  KycPanel,
  KycSection,
} from "@/components/catalyst/kyc-page";
import { listVaults } from "@/lib/data/vaults";
import { investProductPath } from "@/lib/vaults/invest-routes";
import {
  SERIES1_DESCRIPTION,
  SERIES1_DISCLAIMER,
  SERIES1_FULL_NAME,
  SERIES1_NO_RATE_NOTE,
  formatBps,
  series1IsOpen,
  series1StatusLabel,
  series1TargetPockets,
} from "@/lib/vaults/series1";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Reserve Vault · ${SERIES1_FULL_NAME}`,
  description: SERIES1_DESCRIPTION,
};

/** USDC figure → compact institutional string, or an honest dash. */
function formatUsdc(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

/** A labelled row inside a panel — label left, value right, hairline separated. */
function PanelRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
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

function PanelHeader({ title, meta }: { title: string; meta?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
      <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{title}</h3>
      {meta ? <span className="text-xs text-zinc-500 dark:text-zinc-400">{meta}</span> : null}
    </div>
  );
}

export default async function VaultsPage() {
  const vaults = await listVaults();
  // Series 1 is the single shipped product. The first real (non-placeholder)
  // deployment IS Series 1 — we never render a catalogue of alternatives.
  const vault = vaults[0] ?? null;

  if (!vault) {
    return (
      <div data-testid="vaults-page" className="flex flex-col gap-10">
        <KycPageTitle title={SERIES1_FULL_NAME} description={SERIES1_DESCRIPTION} />
        <KycSection>
          <KycEmptyChart
            label="No verified vault deployment"
            detail="Series 1 appears here once its contract is live on-chain with a confirmed deployment address."
          />
        </KycSection>
      </div>
    );
  }

  const pockets = series1TargetPockets(vault);
  const open = series1IsOpen(vault.status);
  const detailHref = investProductPath(vault.id);
  const aum = vault.currentAumUsdc > 0 ? vault.currentAumUsdc : null;
  const capacityPct =
    aum != null && vault.capacityUsdc > 0
      ? Math.min(100, Math.round((aum / vault.capacityUsdc) * 100))
      : null;

  const b1 = pockets.find((p) => p.code === "B1");
  const b2 = pockets.find((p) => p.code === "B2");
  const b3 = pockets.find((p) => p.code === "B3");

  return (
    <div data-testid="vaults-page" className="flex flex-col gap-10">
      <KycPageTitle
        title={SERIES1_FULL_NAME}
        meta={`${vault.ticker} · Methodology v3.0`}
        description={SERIES1_DESCRIPTION}
        actions={
          <Link
            href={detailHref}
            className="inline-flex min-h-10 items-center rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            View Series 1 vault details
          </Link>
        }
      />

      {/* IDENTITY + CAPITAL — status is the hero: an investor first reads
          whether the vault is open, then how the capital is structured. */}
      <KycSection>
        <KycHeroKpiBand
          hero={{
            label: "Vault status",
            value: open ? "Open" : series1StatusLabel(vault.status),
            hint: open
              ? "Active · Permissioned — subscription requires completed onboarding."
              : "Subscriptions are not open at this time.",
          }}
          metrics={[
            {
              label: "B1 Mining Power",
              value: b1 ? formatBps(b1.targetBps) : "—",
              hint: "Target allocation",
            },
            {
              label: "B2 BTC Reserve",
              value: b2 ? formatBps(b2.targetBps) : "—",
              hint: "Target allocation",
            },
            {
              label: "B3 Operating Reserve",
              value: b3 ? formatBps(b3.targetBps) : "—",
              hint: "Target allocation",
            },
            {
              label: "Capital deployed",
              value: formatUsdc(aum),
              hint: capacityPct != null ? `${capacityPct}% of capacity` : "Pending first settlement",
            },
            { label: "Term", value: "24 months", hint: "BTC delivered at maturity" },
            {
              label: "Minimum ticket",
              value: formatUsdc(vault.minTicketUsdc),
              hint: `${vault.softLockupDays}-day soft lock-up`,
            },
          ]}
        />
      </KycSection>

      {/* ALLOCATION — the three on-chain pockets capital flows into. */}
      <KycSection
        index="01"
        title="Allocation"
        description="Capital is structured across three on-chain pockets. Figures are the product target split; the realised on-chain split is not yet indexed per vault."
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

      {/* CONSTRUCTION PATH — how the reserve is actually built. */}
      <KycSection
        index="02"
        title="Reserve construction path"
        description="How mining production converts into the Bitcoin reserve delivered at maturity."
      >
        <KycPanel>
          <div className="divide-y divide-zinc-200/70 dark:divide-white/10">
            <PanelRow
              label="1 · Capital deployed"
              hint="Subscriptions are allocated across B1 / B2 / B3 at the target split."
              value="Permissioned"
            />
            <PanelRow
              label="2 · Mining production"
              hint="B1 hashrate produces Bitcoin; electricity and operations are funded from B3."
              value="Monthly settlement"
            />
            <PanelRow
              label="3 · Reserve accumulation"
              hint="Produced Bitcoin accumulates in B2. The reserve is built from mining production only."
              value="Equity only"
            />
            <PanelRow
              label="4 · Delivery at maturity"
              hint="The accumulated Bitcoin reserve is delivered in BTC at the end of the term."
              value="In BTC"
            />
          </div>
        </KycPanel>
      </KycSection>

      {/* CONTRACT + MATURITY — the structural facts, side by side. */}
      <KycSection index="03" title="Structure">
        <div className="grid gap-5 lg:grid-cols-2">
          <KycPanel>
            <PanelHeader title="Smart contract & share receipt" />
            <div className="divide-y divide-zinc-200/70 border-t border-zinc-200/70 dark:divide-white/10 dark:border-white/10">
              <PanelRow label="Share class" value={vault.shareClass || "—"} />
              <PanelRow label="SPV jurisdiction" value={vault.spvJurisdiction || "—"} />
              <PanelRow label="Exemption" value={vault.regExemption || "—"} />
              <PanelRow
                label="Proof status"
                hint="Attestations and on-chain evidence"
                value="Proof Center"
              />
            </div>
          </KycPanel>

          <KycPanel>
            <PanelHeader title="Maturity & BTC delivery" />
            <div className="divide-y divide-zinc-200/70 border-t border-zinc-200/70 dark:divide-white/10 dark:border-white/10">
              <PanelRow label="Term" value="24 months" hint="From subscription settlement" />
              <PanelRow label="Delivered in" value="BTC" hint="Accumulated reserve, at maturity" />
              <PanelRow
                label="Periodic distribution"
                value="None"
                hint="The note pays no periodic cash and carries no fixed rate."
              />
              <PanelRow
                label="Soft lock-up"
                value={`${vault.softLockupDays} days`}
                hint="Contractual, not enforced on-chain"
              />
            </div>
          </KycPanel>
        </div>
      </KycSection>

      <KycSection>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p className="max-w-3xl text-xs leading-5 text-zinc-500 dark:text-zinc-400">
            {SERIES1_NO_RATE_NOTE} {SERIES1_DISCLAIMER}
          </p>
          <Link
            href={detailHref}
            className="shrink-0 text-sm font-medium text-emerald-700 hover:underline dark:text-emerald-400"
          >
            View Series 1 vault details →
          </Link>
        </div>
      </KycSection>
    </div>
  );
}
