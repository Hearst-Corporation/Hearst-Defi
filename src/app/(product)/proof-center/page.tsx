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

import Link from "next/link";

import {
  getSeries1EventsFromBackend,
  type Envelope,
  type Series1EventsDTO,
} from "@/lib/backend";
import { CHAIN_ID, getVaultAddress, getVaultMode, readGovernance, readOpsState } from "@/lib/chain/dynavault";
import { selectWired } from "@/lib/chain/wired-view";

import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel, Series1PanelHeader, Series1Row, Series1RowList } from "@/components/series1-shell/Series1Panel";
import { Series1Provenance, Series1WiredRow } from "@/components/series1-shell/Series1Wired";
import { Series1ProofEventStepper } from "@/components/proof-center/series1-proof-event-stepper";
import {
  series1ProofStepperErrorState,
  toSeries1ProofStepperStateFromEnvelope,
  type Series1ProofStepperState,
} from "@/lib/proof-center/series1-event-stepper";
import { vaultModeLabel } from "../dashboard/_view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Proof Center · Hearst Bitcoin Reserve Vault — Series 1",
};

/**
 * Indexed-events read → stepper state. A transport failure (fetch itself
 * threw) never reaches `Resolved<T>`, so it is mapped separately from the
 * envelope-status branches inside `toSeries1ProofStepperState`.
 */
async function readProofStepperState(): Promise<Series1ProofStepperState> {
  let envelope: Envelope<Series1EventsDTO>;
  try {
    envelope = await getSeries1EventsFromBackend(200);
  } catch (error) {
    console.error("[proof-center] series1 events fetch failed", error);
    return series1ProofStepperErrorState(error instanceof Error ? error.message : "unknown error");
  }
  return toSeries1ProofStepperStateFromEnvelope(envelope.meta.status, envelope.data.events);
}

export default async function ProductProofCenterPage() {
  const [governance, ops, stepperState] = await Promise.all([
    readGovernance(),
    readOpsState(),
    readProofStepperState(),
  ]);
  const mode = getVaultMode();
  // The proof register catalogues v2.1 events — only a v2 deployment can emit
  // them. "legacy configured" must NOT read as "v2.1 deployed" (the old flag
  // conflated the two and the page contradicted itself).
  const v2Deployed = mode === "v2";
  const vaultAddress = getVaultAddress();

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
                value={vaultAddress ? `${vaultAddress.slice(0, 6)}…${vaultAddress.slice(-4)}` : "TBD"}
                hint={
                  vaultAddress
                    ? v2Deployed
                      ? "PermissionedDynaVault v2.1 deployment"
                      : "Legacy deployment — the v2.1 address has not been posted"
                    : "No vault address configured"
                }
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
        description="Each node below is a real on-chain event the indexer has recorded, ordered by block number."
      >
        <Series1ProofEventStepper state={stepperState} />

        <p className="mt-5 text-xs leading-6 text-zinc-500 dark:text-zinc-400">
          An absent record means the evidence has not been produced yet — it is not a claim that the underlying event
          did not occur. Series 1 accumulates Bitcoin over a 24-month term and settles at maturity; delivery evidence
          appears after a maturity settlement is recorded. Estimated accumulation is disclosed as a range and is not
          guaranteed.
        </p>

        <p className="mt-2 text-xs leading-6">
          <Link
            href="/proof-center/full"
            className="font-semibold text-zinc-950 underline decoration-zinc-950/20 underline-offset-2 hover:decoration-zinc-950/40 dark:text-white dark:decoration-white/20 dark:hover:decoration-white/40"
          >
            View the full evidence register →
          </Link>
        </p>
      </Series1Section>
    </Series1Page>
  );
}
