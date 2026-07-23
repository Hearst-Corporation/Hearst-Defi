// Series1ProofEventStepper — pure mapping from the backend's Series1 events
// read to the state the stepper renders. No JSX, no I/O: given a `Resolved`
// envelope, produce the exact node list + envelope state the component needs.
//
// The event catalogue below (v2.1 interface, VAULT_SPEC_V2.1.md §4) still only
// has three event names the indexer actually decodes today — Deposit, Redeem,
// ElectricityPaid (see hearst-connect-backend/src/application/series1-indexer.ts).
// Everything else in the catalogue is a name the CONTRACT may one day emit,
// not a claim that it has. An `eventName` outside the known set is rendered
// with `isKnownEventType: false` — visible, not crashed, not hidden.

import type { DataStatus, Series1EventSummary } from "@/lib/backend";

export type Series1ProofEnvelopeStatus = "live" | "empty" | "not_configured" | "unavailable" | "error";

export type Series1ProofNetworkKind = "mainnet" | "preprod_fork" | "network_mismatch";

export interface Series1ProofEventProvenance {
  readonly networkKind: Series1ProofNetworkKind;
  readonly label: string;
}

export interface Series1ProofEventNodeModel {
  readonly id: string;
  readonly eventName: string;
  readonly displayLabel: string;
  readonly description: string;
  readonly isKnownEventType: boolean;
  /** Always "indexed" — an event present in this list has already been proved
   *  on-chain by the indexer. There is no "pending" for a real event: pending
   *  only ever describes an EXPECTED step that has not happened yet (out of
   *  scope for V1 — see `expectedSteps` below). */
  readonly status: "indexed";
  readonly blockNumber: string;
  readonly txHash: string;
  readonly logIndex: number;
  readonly investorAddress: string | null;
  readonly assetAmountAtomic: string | null;
  readonly shareAmountAtomic: string | null;
  /** Business timestamp. Null means the fact is legitimately absent — never
   *  backfilled from `indexedAt`, which is a different fact (when the indexer
   *  wrote the row, not when the chain event occurred). */
  readonly occurredAt: string | null;
  readonly indexedAt: string;
  readonly chainId: number;
  readonly contractAddress: string;
  readonly provenance: Series1ProofEventProvenance;
}

/** V1 is disabled — kept as a type so a future pass can wire it without a
 *  breaking change, but the indexer only decodes 3 of the 10 cataloged event
 *  names today. A "pending" checklist item with no possible event to satisfy
 *  it (e.g. "Mining metrics reported") would be a promise the backend cannot
 *  keep — see docs/design-system/DS_DOCTRINE_LOCKED.md §10 (no fake zero /
 *  no fabricated state). */
export interface Series1ProofExpectedStep {
  readonly key: string;
  readonly label: string;
  readonly matchedByEventName: readonly string[];
  readonly state: "pending" | "observed";
}

export interface Series1ProofStepperState {
  readonly envelopeStatus: Series1ProofEnvelopeStatus;
  /** Set only when envelopeStatus === "not_configured", to distinguish a
   *  genuinely empty indexer from a SIMULATED read that was refused as proof. */
  readonly notConfiguredReason?: "simulated_rejected" | "not_configured";
  readonly events: readonly Series1ProofEventNodeModel[];
  readonly expectedSteps?: readonly Series1ProofExpectedStep[];
  readonly errorDetail?: string;
}

const KNOWN_EVENT_META: Record<string, { label: string; description: string }> = {
  Deposit: { label: "Capital in", description: "Investor subscription — USDC deposited, shares minted." },
  Redeem: { label: "Capital out", description: "Investor redemption — shares burned, USDC returned." },
  ElectricityPaid: { label: "Electricity settled", description: "B3 operating reserve paid the electricity invoice." },
  Rebalance: { label: "Pocket rebalancing", description: "Allocation moved across the B1 / B2 / B3 pockets." },
  VaultSwapped: { label: "Vault swap", description: "The vault's underlying strategy allocation changed." },
  MiningMetricsReported: { label: "Mining metrics", description: "The keeper reported hashrate and BTC production." },
  CurtailmentTriggered: { label: "Curtailment triggered", description: "Mining output was curtailed by policy." },
  CurtailmentLifted: { label: "Curtailment lifted", description: "A prior curtailment was lifted." },
  TakeProfitExecuted: { label: "Take-profit executed", description: "A rule-based take-profit was executed on the BTC reserve." },
  MonthlyEngineRun: { label: "Monthly engine run", description: "The product engine advanced to the next contractual month." },
};

const UNKNOWN_EVENT_LABEL = "On-chain event";
const UNKNOWN_EVENT_DESCRIPTION = "Indexed on-chain event, type not yet catalogued.";

/** Mainnet chain ids Series 1 is expected to deploy on. Anything else that
 *  isn't the known preprod fork id is a mismatch — surfaced, never hidden. */
const MAINNET_CHAIN_IDS = new Set<number>([1, 8453]);
const PREPROD_FORK_CHAIN_ID = 31337;

function provenanceForChain(chainId: number): Series1ProofEventProvenance {
  if (chainId === PREPROD_FORK_CHAIN_ID) {
    return { networkKind: "preprod_fork", label: "Fork preprod" };
  }
  if (MAINNET_CHAIN_IDS.has(chainId)) {
    return { networkKind: "mainnet", label: "Mainnet" };
  }
  return { networkKind: "network_mismatch", label: "Network mismatch" };
}

function toNodeModel(event: Series1EventSummary): Series1ProofEventNodeModel {
  const meta = KNOWN_EVENT_META[event.eventName];
  return {
    id: event.id,
    eventName: event.eventName,
    displayLabel: meta?.label ?? UNKNOWN_EVENT_LABEL,
    description: meta?.description ?? UNKNOWN_EVENT_DESCRIPTION,
    isKnownEventType: meta !== undefined,
    status: "indexed",
    blockNumber: event.blockNumber,
    txHash: event.txHash,
    logIndex: event.logIndex,
    investorAddress: event.investorAddress,
    assetAmountAtomic: event.assetAmountAtomic,
    shareAmountAtomic: event.shareAmountAtomic,
    occurredAt: event.occurredAt,
    indexedAt: event.indexedAt,
    chainId: event.chainId,
    contractAddress: event.contractAddress,
    provenance: provenanceForChain(event.chainId),
  };
}

/** Ordered by blockNumber asc, then logIndex asc — the chain's own order, not
 *  a narrative one. BigInt-safe compare since blockNumber is a decimal string. */
function compareByChainOrder(a: Series1EventSummary, b: Series1EventSummary): number {
  const blockDelta = BigInt(a.blockNumber) - BigInt(b.blockNumber);
  if (blockDelta !== 0n) return blockDelta < 0n ? -1 : 1;
  return a.logIndex - b.logIndex;
}

/** The minimal shape this mapper needs from `Resolved<readonly Series1EventSummary[]>`
 *  — kept structural (not importing the generic `Resolved<T>`) so this module
 *  has no dependency beyond the one field it reads. */
interface ResolvedEventsLike {
  readonly status: DataStatus;
  readonly value: readonly Series1EventSummary[] | null;
}

/**
 * Map the backend's `Resolved<Series1EventSummary[]>` read to the stepper's
 * state.
 *
 * Contract note: `Resolved<T>.status` is `DataStatus`
 * (LIVE | STALE | PARTIAL | UNAVAILABLE | NOT_CONFIGURED | NOT_SUPPORTED |
 * PERMISSION_DENIED) — it does NOT include "SNAPSHOT" or "SIMULATED", which
 * belong to the separate envelope-level `EnvelopeStatus` union (`meta.status`
 * on `Envelope<T>`, one level up, not read here). `GET /api/v1/series1/events`
 * only ever resolves `Resolved.status` to LIVE, NOT_CONFIGURED or UNAVAILABLE
 * today (see contracts.ts's comment on `Series1EventsDTO`). Decision 008's
 * "SIMULATED → not_configured" rule is therefore enforced at the envelope
 * level by the caller (`readProofStepperState` in the page) BEFORE this
 * function ever sees a `Resolved<T>` — this function stays honest about what
 * `DataStatus` can actually be, rather than guarding against a value that
 * cannot occur here.
 */
export function toSeries1ProofStepperState(resolved: ResolvedEventsLike): Series1ProofStepperState {
  if (resolved.status === "LIVE" || resolved.status === "STALE") {
    const events = resolved.value ?? [];
    if (events.length === 0) {
      return { envelopeStatus: "empty", events: [] };
    }
    const sorted = [...events].sort(compareByChainOrder);
    return { envelopeStatus: "live", events: sorted.map(toNodeModel) };
  }
  if (resolved.status === "NOT_CONFIGURED") {
    return { envelopeStatus: "not_configured", notConfiguredReason: "not_configured", events: [] };
  }
  // UNAVAILABLE, PARTIAL, NOT_SUPPORTED, PERMISSION_DENIED — none of these
  // claim a real ledger; the honest read is "the outage/read failed", not
  // "the ledger is empty".
  return { envelopeStatus: "unavailable", events: [] };
}

/** Transport-level failure (the fetch itself threw) — never reaches `Resolved<T>`. */
export function series1ProofStepperErrorState(detail: string): Series1ProofStepperState {
  return { envelopeStatus: "error", events: [], errorDetail: detail };
}

/**
 * Full entry point: given the envelope's own `meta.status` (Decision 008's
 * SIMULATED check belongs HERE, one level up from `Resolved<T>.status` —
 * see the contract note on `toSeries1ProofStepperState`) and the
 * `Resolved<Series1EventSummary[]>` read, produce the stepper state.
 * A SIMULATED envelope is rejected before the resolved value is ever
 * inspected — simulated data is never rendered as investor-facing proof,
 * regardless of what `Resolved.status`/`.value` happen to carry.
 */
export function toSeries1ProofStepperStateFromEnvelope(
  envelopeStatus: string,
  resolved: ResolvedEventsLike,
): Series1ProofStepperState {
  if (envelopeStatus === "SIMULATED") {
    return { envelopeStatus: "not_configured", notConfiguredReason: "simulated_rejected", events: [] };
  }
  return toSeries1ProofStepperState(resolved);
}
