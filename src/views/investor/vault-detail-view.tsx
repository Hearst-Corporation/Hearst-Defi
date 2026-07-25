import Link from "next/link";

import type { VaultDetailData } from "@/app/(product)/vaults/[id]/_data/vault-detail-loader";
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
import {
  Disclaimer,
  PageActions,
  PageHeader,
  PageLayout,
  Panel,
  Row,
  RowList,
  Section,
} from "@/views/_shared/layout";
import { Kpi, KpiGrid } from "@/ui";

import { VaultChainReadoutPanel } from "./vault-chain-readout-panel";

function formatUsdc(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000)}k`;
  return `$${Math.round(value)}`;
}

function formatAtomicUsdc(atomic: string | null): string {
  if (atomic === null) return "—";
  const value = Number(BigInt(atomic) / 1_000_000n);
  if (!Number.isFinite(value) || value <= 0) return "—";
  return formatUsdc(value);
}

export function VaultDetailView({ vault, backend }: VaultDetailData) {
  if (!vault) return null;

  const open = series1IsOpen(vault.status);
  const pockets = series1TargetPockets(vault);
  const backendSnapshot = backend.state === "ok" ? backend.snapshot : null;
  const backendTerms = backend.state === "ok" ? backend.terms : null;
  const liveAumAtomic =
    backendSnapshot?.status === "wired" ? backendSnapshot.data.totalAssets : null;
  const termMonths =
    backendTerms?.status === "wired" ? backendTerms.data.productDurationMonths : null;
  const termLabel = termMonths !== null ? `${termMonths} months` : "—";
  const safeDisclaimer = series1SafeDisclaimer(vault.disclaimers);
  const spv = SPV_LABELS_LONG[vault.spvJurisdiction] ?? vault.spvJurisdiction ?? "—";
  const reg = REG_LABELS_LONG[vault.regExemption] ?? vault.regExemption ?? "—";

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Series 1"
        title={SERIES1_FULL_NAME}
        meta={`${vault.ticker} · Methodology v3.0`}
        description={SERIES1_DESCRIPTION}
        actions={
          open ? (
            <PageActions
              primary={{
                href: investDepositPath(vault.id),
                label: "Continue to subscription",
              }}
            />
          ) : (
            <PageActions
              primary={{
                href: INVEST_SELECT_PATH,
                label: "Back to vault overview",
              }}
            />
          )
        }
      />

      <KpiGrid>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Vault status"
              value={open ? "Open" : series1StatusLabel(vault.status)}
              provenance="live"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi label="Term" value={termLabel} provenance="manual" />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Minimum ticket"
              value={
                backendTerms?.status === "wired"
                  ? formatAtomicUsdc(backendTerms.data.minimumDepositUsdc)
                  : formatUsdc(vault.minTicketUsdc)
              }
              provenance="manual"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Soft lock-up"
              value={`${vault.softLockupDays} days`}
              provenance="manual"
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Capital deployed"
              value={formatAtomicUsdc(liveAumAtomic)}
              provenance={liveAumAtomic !== null ? "live" : "stale"}
            />
          </div>
        </Panel>
        <Panel>
          <div className="p-5">
            <Kpi
              label="Capacity"
              value={formatUsdc(vault.capacityUsdc)}
              provenance="manual"
            />
          </div>
        </Panel>
      </KpiGrid>

      <Section
        index="01"
        title="On-chain state"
        description="What the vault contract returns right now, alongside the recorded snapshot aggregate."
      >
        <VaultChainReadoutPanel dbAumUsdc={vault.currentAumUsdc} />
      </Section>

      <Section
        index="02"
        title="Allocation"
        description="The three on-chain pockets capital is structured across. Product target split — the realised on-chain split is not yet indexed per vault."
      >
        <Panel>
          <RowList>
            {pockets.map((pocket) => (
              <Row
                key={pocket.code}
                label={`${pocket.code} · ${pocket.label}`}
                hint={pocket.role}
                value={formatBps(pocket.targetBps)}
              />
            ))}
          </RowList>
        </Panel>
      </Section>

      <Section index="03" title="Structure & delivery">
        <div className="grid gap-5 lg:grid-cols-2">
          <Panel title="Share receipt & structure">
            <RowList>
              <Row label="Share class" value={vault.shareClass || "—"} />
              <Row label="SPV" value={spv} />
              <Row label="Exemption" value={reg} />
              <Row
                label="Management / performance"
                hint={`Hurdle ${(vault.fees.hurdleBps / 100).toFixed(2)}%`}
                value={`${(vault.fees.mgmtBps / 100).toFixed(2)}% / ${(vault.fees.perfBps / 100).toFixed(2)}%`}
              />
            </RowList>
          </Panel>

          <Panel title="Maturity & BTC delivery">
            <RowList>
              <Row
                label="Term"
                value={termLabel}
                hint="From subscription settlement"
              />
              <Row
                label="Delivered in"
                value="BTC"
                hint="The accumulated reserve, transferred at maturity"
              />
              <Row
                label="Periodic distribution"
                value="None"
                hint="No periodic cash and no fixed rate at any point in the term"
              />
              <Row
                label="Proof status"
                value={
                  <Link href="/proof-center" className="text-accent hover:underline">
                    Proof Center
                  </Link>
                }
                hint="Attestations and on-chain evidence"
              />
            </RowList>
          </Panel>
        </div>
      </Section>

      <Disclaimer>
        {SERIES1_NO_RATE_NOTE}
        {safeDisclaimer ? ` ${safeDisclaimer}` : ""} {SERIES1_DISCLAIMER}
      </Disclaimer>
    </PageLayout>
  );
}
