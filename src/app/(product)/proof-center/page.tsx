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
  type Series1EventSummary,
} from "@/lib/backend";
import { CHAIN_ID, getVaultAddress, getVaultMode, readGovernance, readOpsState } from "@/lib/chain/dynavault";
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

/** Ethereum mainnet + Base mainnet — anything else is labeled as such. */
const MAINNET_CHAIN_IDS = new Set([1, 8453]);

function chainLabel(chainId: number): string {
  if (chainId === 31337) return `fork (chain ${chainId})`;
  if (chainId === 84532) return `Base Sepolia (chain ${chainId})`;
  return `chain ${chainId}`;
}

/**
 * Indexed-events read: LIVE → real rows; NOT_CONFIGURED → indexer has no rows
 * (an honest product state); UNAVAILABLE covers both the backend's own
 * "db_error" and a transport failure reaching it — a panne, never rendered as
 * an empty ledger.
 */
type EventsRead =
  | { kind: "live"; events: readonly Series1EventSummary[] }
  | { kind: "not_configured" }
  | { kind: "unavailable" };

async function readIndexedEvents(): Promise<EventsRead> {
  let envelope: Envelope<Series1EventsDTO>;
  try {
    envelope = await getSeries1EventsFromBackend(200);
  } catch (error) {
    console.error("[proof-center] series1 events fetch failed", error);
    return { kind: "unavailable" };
  }
  const resolved = envelope.data.events;
  if (resolved.status === "LIVE" && resolved.value) return { kind: "live", events: resolved.value };
  if (resolved.status === "NOT_CONFIGURED") return { kind: "not_configured" };
  return { kind: "unavailable" };
}

export default async function ProductProofCenterPage() {
  const [governance, ops, indexed] = await Promise.all([readGovernance(), readOpsState(), readIndexedEvents()]);
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
        description="Each record below is an on-chain event the vault emits. Records are indexed once the contract is deployed and the lifecycle event occurs."
      >
        {indexed.kind === "unavailable" ? (
          <div className="mb-4 flex items-center gap-3">
            <Series1ProvenanceTag status="unavailable" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Indexer unreachable — indexed counts cannot be shown right now. This is an outage of the read, not a
              statement that no record exists.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROOF_EVENTS.map((block) => {
            const matching = indexed.kind === "live" ? indexed.events.filter((e) => e.eventName === block.event) : [];
            const latest = matching[0] ?? null;
            const nonMainnetChainIds =
              indexed.kind === "live"
                ? [...new Set(matching.map((e) => e.chainId))].filter((id) => !MAINNET_CHAIN_IDS.has(id))
                : [];
            return (
              <Series1Panel key={block.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold tracking-[0.1em] text-zinc-500 uppercase dark:text-zinc-400">
                      {block.eyebrow}
                    </span>
                    <h3 className="text-sm font-semibold text-zinc-950 dark:text-white">{block.title}</h3>
                  </div>
                  {/* Once v2.1 deploys, "Not configured" would contradict the
                      footer's "No record indexed yet" — the footer alone carries
                      the state then. */}
                  {latest ? (
                    <Series1ProvenanceTag status="live" />
                  ) : v2Deployed ? null : (
                    <Series1ProvenanceTag status="configured" />
                  )}
                </div>
                {latest ? (
                  <p className="mt-3 text-[10px] leading-5 text-zinc-500 dark:text-zinc-400">
                    Latest: tx {latest.txHash.slice(0, 10)}…{latest.txHash.slice(-6)} · block {latest.blockNumber}
                    {nonMainnetChainIds.length > 0 ? (
                      <>
                        <br />
                        Indexed on {nonMainnetChainIds.map(chainLabel).join(", ")} — not mainnet
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center justify-between gap-3 border-t border-zinc-950/5 pt-3 dark:border-white/10">
                  <span className="text-[10px] tracking-tight text-zinc-500 dark:text-zinc-400">{block.event}</span>
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                    {latest
                      ? `${matching.length} record${matching.length === 1 ? "" : "s"} indexed`
                      : indexed.kind === "unavailable"
                        ? "Indexer unreachable"
                        : v2Deployed || indexed.kind === "live"
                          ? "No record indexed yet"
                          : "Awaiting v2.1 deployment"}
                  </span>
                </div>
              </Series1Panel>
            );
          })}
        </div>

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
