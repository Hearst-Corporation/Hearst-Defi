// /proof-center — Proof Center.
//
// The evidence surface: which contract answers, on which network, and which of
// its events have produced a record. The distinction this page exists to keep
// is "proof unavailable" ≠ "no proof": until v2.1 is deployed there is nothing
// to index, and saying so is different from claiming an empty ledger.
//
// Contract identity is read through the server-only adapter. The event
// catalogue below is the v2.1 interface (VAULT_SPEC_V2.1.md §4) — it states
// what WILL be evidenced, never that a record exists.

import { CHAIN_ID, getVaultMode, readGovernance, readOpsState } from "@/lib/chain/dynavault";
import { selectWired } from "@/lib/chain/wired-view";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1ProvenanceTag } from "@/components/series1-shell/Series1ChartPlaceholder";
import { Series1Provenance, Series1WiredRow } from "@/components/series1-shell/Series1Wired";
import { vaultModeLabel } from "../dashboard/_view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proof Center · Hearst Bitcoin Reserve Vault — Series 1",
};

/**
 * The v2.1 event surface (VAULT_SPEC_V2.1.md §4). Each row names an event the
 * contract emits and the lifecycle moment it evidences. Rows carry no count:
 * a count would imply an indexed ledger, and none exists until deployment.
 */
const PROOF_EVENTS = [
  { id: "deposit", event: "Deposit", eyebrow: "Subscription", title: "Capital in" },
  { id: "redeem", event: "Redeem", eyebrow: "Redemption", title: "Capital out" },
  { id: "rebalance", event: "Rebalance", eyebrow: "Allocation", title: "Pocket rebalancing" },
  { id: "swap", event: "VaultSwapped", eyebrow: "Allocation", title: "Vault swap" },
  { id: "electricity", event: "ElectricityPaid", eyebrow: "Operations", title: "Electricity settled" },
  { id: "mining", event: "MiningMetricsReported", eyebrow: "Operations", title: "Mining metrics" },
  { id: "curtail", event: "CurtailmentTriggered", eyebrow: "Operations", title: "Curtailment triggered" },
  { id: "curtail-lift", event: "CurtailmentLifted", eyebrow: "Operations", title: "Curtailment lifted" },
  { id: "take-profit", event: "TakeProfitExecuted", eyebrow: "Reserve", title: "Take-profit executed" },
  { id: "engine", event: "MonthlyEngineRun", eyebrow: "Engine", title: "Monthly engine run" },
] as const;

export default async function ProductProofCenterPage() {
  const [governance, ops] = await Promise.all([readGovernance(), readOpsState()]);
  const mode = getVaultMode();
  const deployed = mode !== "not_configured";

  return (
    <Series1Page>
      <Series1PageTitle
        title="Proof Center"
        meta={vaultModeLabel(mode)}
        description="Source evidence for mining, reserve, custody and delivery across the Series 1 lifecycle."
      />

      <Series1Section
        index="01"
        title="Contract & network"
        description="Which contract answers for this product, and on which network."
      >
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Series1Panel>
            <Series1PanelHeader title="Deployment" description={<Series1Provenance read={governance} />} />
            <Series1RowList>
              <Series1Row label="Contract" value={vaultModeLabel(mode)} />
              <Series1Row
                label="Network"
                value="Base Sepolia"
                hint={`chainId ${CHAIN_ID} · testnet only`}
              />
              <Series1Row
                label="Vault address"
                value={deployed ? "Configured" : "TBD"}
                hint={deployed ? "Resolved from deployment config" : "v2.1 address has not been posted"}
              />
              <Series1WiredRow
                label="Keeper"
                read={selectWired(governance, (g) => g.keeper)}
                render={(k) => `${k.slice(0, 6)}…${k.slice(-4)}`}
                hint="Operational keeper EOA"
              />
              <Series1WiredRow
                label="Owner"
                read={selectWired(governance, (g) => g.owner)}
                render={(o) => `${o.slice(0, 6)}…${o.slice(-4)}`}
                hint="Contract owner"
              />
            </Series1RowList>
          </Series1Panel>

          <Series1Panel>
            <Series1PanelHeader title="Engine state" description={<Series1Provenance read={ops} />} />
            <Series1RowList>
              <Series1WiredRow
                label="Product month"
                read={selectWired(ops, (o) => o.currentMonth)}
                render={(m) => m.toString()}
                hint="currentMonth()"
              />
              <Series1WiredRow
                label="Curtailment"
                read={selectWired(ops, (o) => o.isCurtailed)}
                render={(c) => (c ? "Active" : "None")}
                hint="isCurtailed()"
              />
              <Series1WiredRow
                label="Mining Note mode"
                read={selectWired(ops, (o) => o.miningNoteMode)}
                render={(m) => (m ? "Enforced" : "Advisory")}
                hint="40 / 27 / 33 policy split"
              />
            </Series1RowList>
          </Series1Panel>
        </div>
      </Series1Section>

      <Series1Section
        index="02"
        title="Proof register"
        description="Each record below is an on-chain event the vault emits. Records are indexed once the contract is deployed and the lifecycle event occurs."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROOF_EVENTS.map((block) => (
            <Series1Panel key={block.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span
                    className="text-xs font-semibold tracking-[0.1em] uppercase"
                    style={{ color: "var(--s1-muted)" }}
                  >
                    {block.eyebrow}
                  </span>
                  <h3 className="text-sm font-semibold">{block.title}</h3>
                </div>
                <Series1ProvenanceTag status={deployed ? "configured" : "unavailable"} />
              </div>
              <div
                className="mt-4 flex items-center justify-between gap-3 border-t pt-3"
                style={{ borderColor: "var(--s1-line)" }}
              >
                <span className="font-mono text-[10px]" style={{ color: "var(--s1-muted)" }}>
                  {block.event}
                </span>
                <span className="text-[10px]" style={{ color: "var(--s1-muted)" }}>
                  {deployed ? "No record indexed yet" : "Awaiting deployment"}
                </span>
              </div>
            </Series1Panel>
          ))}
        </div>

        <p className="mt-5 text-xs leading-6" style={{ color: "var(--s1-muted)" }}>
          An absent record means the evidence has not been produced yet — it is not a claim that the underlying event
          did not occur. Series 1 accumulates Bitcoin over a 24-month term and settles at maturity; delivery evidence
          appears after a maturity settlement is recorded. Estimated accumulation is disclosed as a range and is not
          guaranteed.
        </p>
      </Series1Section>
    </Series1Page>
  );
}
