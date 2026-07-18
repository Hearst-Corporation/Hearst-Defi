import "server-only";

import { loadCoverageForVault } from "@/lib/agents/loaders/coverage";
import { isChainConfigured } from "@/lib/chain/client";
import { fetchOnChainEvents } from "@/lib/chain/event-logger";
import { fetchOnChainAttestations } from "@/lib/chain/por-registry";
import { loadCustody } from "@/lib/data/custody";
import {
  loadRecentDistributions,
  loadRecentRebalances,
  PROOF_CENTER_VAULT_REF,
} from "@/lib/data/proof-center";
import type { CoverageView } from "@/lib/engine/coverage-view";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { OnChainEvent } from "@/lib/chain/event-logger";
import type { CustodySnapshot } from "@/lib/data/custody";
import type {
  ProofCenterDistributionRow,
  ProofCenterRebalanceRow,
} from "@/lib/data/proof-center";
import type { PlatformAddressEntry } from "@/components/proof-center/contracts-audit-trail";
import { buildPlatformAddresses } from "@/lib/proof-center/platform-addresses";
import { latestAttestationVerified } from "@/lib/proof-center/attestation-truth";
import { isProofCenterColdEmpty } from "@/lib/proof-center/cold-empty";
import { loadProofHubColdCounts } from "@/lib/proof-center/hub-counts";

/**
 * Provenance kinds used by the Series 1 institutional proof rail. Mirrors the
 * `provenance-badge` vocabulary (Live / Oracle / Attested / Estimated / Manual /
 * Stale) so a block never claims more than its underlying source supports.
 */
export type ProofBlockProvenance =
  | "attested"
  | "live"
  | "oracle"
  | "estimated"
  | "manual"
  | "stale";

/**
 * Honest presence state for an institutional proof block. `absent` renders an
 * honest empty surface — never a fake "Live"/"Verified" badge, never a
 * fabricated chart (product invariant: no fake live).
 */
export type ProofBlockState = "present" | "pending" | "absent";

/**
 * The ordered set of institutional proof blocks that make up the Reserve Vault
 * Series 1 proof narrative. `distributions` is intentionally NOT in this union:
 * Series 1 accumulates BTC over a 24-month term and delivers at maturity — there
 * is no periodic cash distribution, so "latest distributions" is not a proof
 * block of this instrument.
 */
export type ProofBlockKind =
  | "mining"
  | "reserves"
  | "custody"
  | "delivery"
  | "contract-events"
  | "take-profit-curtailment"
  | "freshness";

/** One institutional proof block, with strict per-block provenance + honesty. */
export interface Series1ProofBlock {
  kind: ProofBlockKind;
  /** Short institutional label (e.g. "Proof of Reserves"). */
  title: string;
  /** One-line eyebrow/context for the block. */
  eyebrow: string;
  /** Provenance of the freshest source backing this block. */
  provenance: ProofBlockProvenance;
  /** Honest presence — drives present vs. pending vs. honest-empty rendering. */
  state: ProofBlockState;
  /** ISO timestamp of the freshest source row backing this block, if any. */
  lastUpdated: string | null;
  /** Count of underlying evidence items (attestations, events, accounts…). */
  evidenceCount: number;
}

/** One point on the proof-freshness timeline — a real source and its age. */
export interface ProofFreshnessEntry {
  label: string;
  provenance: ProofBlockProvenance;
  lastUpdated: string | null;
  stale: boolean;
}

const STALE_MS = 24 * 60 * 60 * 1000;

function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > STALE_MS;
}

/**
 * On-chain event kinds that evidence take-profit / curtailment operations for
 * the Series 1 mining note. `Rebalance` covers pocket take-profit sweeps; `ModeChange`
 * covers curtailment mode transitions; `GuardrailBreach` / `TriggerArmed` are
 * curtailment guardrails. `Distribution` here is on-chain *settlement*, not a
 * periodic cash distribution.
 */
const TAKE_PROFIT_CURTAILMENT_KINDS = new Set([
  "Rebalance",
  "ModeChange",
  "GuardrailBreach",
  "TriggerArmed",
]);

/**
 * Reserve pocket coverage for Series 1 (B1 Mining Power / B2 BTC Pouch / B3
 * Reserve USDC). This is provenance metadata — the actual pocket balances render
 * from custody + attestation sources; here we only expose which pockets are
 * evidenced so a block never claims a pocket it has no source for.
 */
export interface ReservePocketCoverage {
  /** B1 Mining Power — evidenced by mining coverage inputs. */
  b1Evidenced: boolean;
  /** B2 BTC Pouch — evidenced by an on-chain PoR attestation (mined BTC). */
  b2Evidenced: boolean;
  /** B3 Reserve USDC — evidenced by live custody with non-zero reserves. */
  b3Evidenced: boolean;
}

export interface ProofCenterHubData {
  chainConfigured: boolean;
  latestAttestation: OnChainAttestation | null;
  attestationVerified: boolean;
  custody: CustodySnapshot | null;
  coverage: CoverageView;
  recentDistributions: ProofCenterDistributionRow[];
  recentRebalances: ProofCenterRebalanceRow[];
  platformAddresses: PlatformAddressEntry[];
  coldEmpty: boolean;
  // ── Series 1 institutional proof model (additive) ─────────────────────────
  /**
   * Number of periodic cash distributions found. Series 1 has none by design;
   * this is kept only so existing consumers/tests can read a count. It is NOT
   * a headline metric of this instrument.
   */
  distributionsCount: number;
  /**
   * True when the "latest distributions" rail is de-prioritized (always, for the
   * Series 1 mining note — no periodic distribution). Consumers use this to keep
   * distributions out of the primary proof rail.
   */
  distributionsDeprioritized: boolean;
  /** Ordered institutional proof blocks — the primary Series 1 rail. */
  series1Proof: Series1ProofBlock[];
  /** Reserve pocket coverage (B1/B2/B3) — which pockets have a live source. */
  reservePockets: ReservePocketCoverage;
  /** Proof-freshness timeline across every source, with honest staleness. */
  proofFreshness: ProofFreshnessEntry[];
}

function coverageBlockProvenance(coverage: CoverageView): ProofBlockProvenance {
  switch (coverage?.provenance) {
    case "live":
      return "live";
    case "estimated":
      return "estimated";
    case "invalid":
      return "stale";
    default:
      return "manual";
  }
}

function attestationBlockProvenance(
  attestation: OnChainAttestation | null,
  verified: boolean,
): ProofBlockProvenance {
  if (!attestation) return "manual";
  if (isStale(attestation.timestamp.toISOString())) return "stale";
  return verified ? "attested" : "oracle";
}

function custodyBlockProvenance(custody: CustodySnapshot | null): ProofBlockProvenance {
  if (!custody) return "manual";
  if (custody.provenance === "live" && custody.configured) return "live";
  if (isStale(custody.asOf)) return "stale";
  return "manual";
}

/**
 * Build the ordered institutional proof blocks from already-fetched sources.
 * Pure over its inputs — every block reports honest presence + provenance, no
 * fabrication when a source is missing.
 */
function buildSeries1Proof(input: {
  coverage: CoverageView;
  attestation: OnChainAttestation | null;
  attestationVerified: boolean;
  custody: CustodySnapshot | null;
  onChainEvents: OnChainEvent[];
  distributions: ProofCenterDistributionRow[];
}): Series1ProofBlock[] {
  const {
    coverage,
    attestation,
    attestationVerified,
    custody,
    onChainEvents,
    distributions,
  } = input;

  const miningPresent = coverage?.provenance === "live" || coverage?.provenance === "estimated";
  const custodyPresent =
    custody !== null && custody.provenance === "live" && custody.totalUsdcReserves > 0;

  const takeProfitEvents = onChainEvents.filter((e) =>
    TAKE_PROFIT_CURTAILMENT_KINDS.has(e.kind),
  );
  // On-chain settlement of accumulated BTC at maturity — evidenced by
  // Distribution-kind events (on-chain settlement, not a periodic payout).
  const deliveryEvents = onChainEvents.filter((e) => e.kind === "Distribution");

  const attestationTs = attestation ? attestation.timestamp.toISOString() : null;
  const latestEventTs = onChainEvents[0] ? onChainEvents[0].timestamp.toISOString() : null;
  const latestTakeProfitTs = takeProfitEvents[0]
    ? takeProfitEvents[0].timestamp.toISOString()
    : null;
  const latestDeliveryTs = deliveryEvents[0]
    ? deliveryEvents[0].timestamp.toISOString()
    : null;

  return [
    {
      kind: "mining",
      title: "Proof of Mining",
      eyebrow: "Accumulation source",
      provenance: coverageBlockProvenance(coverage),
      state: miningPresent ? "present" : coverage?.provenance === "pending" ? "pending" : "absent",
      lastUpdated: coverage?.lastUpdated ?? null,
      evidenceCount: coverage?.missingInputs?.length === 0 ? 1 : 0,
    },
    {
      kind: "reserves",
      title: "Proof of Reserves",
      eyebrow: "On-chain pockets B1 / B2 / B3 · PoR registry",
      provenance: attestationBlockProvenance(attestation, attestationVerified),
      state: attestation ? "present" : "absent",
      lastUpdated: attestationTs,
      evidenceCount: attestation ? 1 : 0,
    },
    {
      kind: "custody",
      title: "Proof of Custody",
      eyebrow: "Reserve USDC · Fireblocks",
      provenance: custodyBlockProvenance(custody),
      state: custodyPresent ? "present" : "absent",
      lastUpdated: custody?.asOf ?? null,
      evidenceCount: custody?.accountsCount ?? 0,
    },
    {
      kind: "delivery",
      title: "Proof of Delivery",
      eyebrow: "BTC settlement at maturity",
      provenance: deliveryEvents.length > 0 ? "live" : "manual",
      // Series 1 delivers BTC at maturity — before then, honestly absent.
      state: deliveryEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestDeliveryTs,
      evidenceCount: deliveryEvents.length,
    },
    {
      kind: "contract-events",
      title: "Contract Events",
      eyebrow: "On-chain event log",
      provenance: onChainEvents.length > 0 ? "live" : "manual",
      state: onChainEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestEventTs,
      evidenceCount: onChainEvents.length,
    },
    {
      kind: "take-profit-curtailment",
      title: "Take-profit & Curtailment",
      eyebrow: "Vault operations",
      provenance: takeProfitEvents.length > 0 ? "live" : "manual",
      state: takeProfitEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestTakeProfitTs,
      evidenceCount: takeProfitEvents.length,
    },
    {
      kind: "freshness",
      title: "Proof Freshness",
      eyebrow: "Source recency",
      // Freshness is derived meta — provenance follows the freshest live source.
      provenance:
        !isStale(attestationTs) || !isStale(latestEventTs) || (custody?.provenance === "live")
          ? "live"
          : "stale",
      state:
        attestation || onChainEvents.length > 0 || custodyPresent || distributions.length > 0
          ? "present"
          : "absent",
      lastUpdated:
        [attestationTs, latestEventTs, custody?.asOf ?? null]
          .filter((x): x is string => x !== null)
          .sort()
          .at(-1) ?? null,
      evidenceCount: onChainEvents.length + (attestation ? 1 : 0) + (custodyPresent ? 1 : 0),
    },
  ];
}

function buildProofFreshness(input: {
  coverage: CoverageView;
  attestation: OnChainAttestation | null;
  attestationVerified: boolean;
  custody: CustodySnapshot | null;
  onChainEvents: OnChainEvent[];
}): ProofFreshnessEntry[] {
  const { coverage, attestation, attestationVerified, custody, onChainEvents } = input;

  const attestationTs = attestation ? attestation.timestamp.toISOString() : null;
  const eventTs = onChainEvents[0] ? onChainEvents[0].timestamp.toISOString() : null;

  return [
    {
      label: "PoR attestation",
      provenance: attestationBlockProvenance(attestation, attestationVerified),
      lastUpdated: attestationTs,
      stale: isStale(attestationTs),
    },
    {
      label: "On-chain events",
      provenance: onChainEvents.length > 0 ? "live" : "manual",
      lastUpdated: eventTs,
      stale: isStale(eventTs),
    },
    {
      label: "Custody snapshot",
      provenance: custodyBlockProvenance(custody),
      lastUpdated: custody?.asOf ?? null,
      stale: isStale(custody?.asOf ?? null),
    },
    {
      label: "Mining coverage",
      provenance: coverageBlockProvenance(coverage),
      lastUpdated: coverage?.lastUpdated ?? null,
      stale: isStale(coverage?.lastUpdated ?? null),
    },
  ];
}

/** Shared loader for investor + admin Proof Center hub pages. */
export async function loadProofCenterHubData(
  demo = false,
  vaultRef: string = PROOF_CENTER_VAULT_REF,
): Promise<ProofCenterHubData> {
  const coveragePeriod = new Date().toISOString().slice(0, 7);

  const [
    onChainEvents,
    onChainAttestations,
    custody,
    coverage,
    recentDistributions,
    recentRebalances,
    coldCounts,
  ] = await Promise.all([
    fetchOnChainEvents({ limit: 20 }),
    fetchOnChainAttestations({ limit: 12 }),
    loadCustody(),
    loadCoverageForVault(vaultRef, coveragePeriod),
    loadRecentDistributions(vaultRef, 6),
    loadRecentRebalances(vaultRef, 5),
    loadProofHubColdCounts(),
  ]);

  const latestAttestation = onChainAttestations[0] ?? null;
  const attestationVerified = latestAttestationVerified(onChainAttestations);

  const series1Proof = buildSeries1Proof({
    coverage,
    attestation: latestAttestation,
    attestationVerified,
    custody,
    onChainEvents,
    distributions: recentDistributions,
  });

  const reservePockets: ReservePocketCoverage = {
    b1Evidenced: coverage?.provenance === "live" || coverage?.provenance === "estimated",
    b2Evidenced: latestAttestation !== null,
    b3Evidenced:
      custody !== null && custody.provenance === "live" && custody.totalUsdcReserves > 0,
  };

  return {
    chainConfigured: isChainConfigured(),
    latestAttestation,
    attestationVerified,
    custody,
    coverage,
    recentDistributions,
    recentRebalances,
    platformAddresses: buildPlatformAddresses(custody, vaultRef),
    coldEmpty: isProofCenterColdEmpty({
      demo,
      hasAttestation: latestAttestation !== null,
      proofsCount: coldCounts.proofsCount,
      onChainEventsCount: onChainEvents.length,
      distributionsCount: recentDistributions.length,
      rebalancesCount: recentRebalances.length,
      timelockCount: coldCounts.timelockCount,
    }),
    // ── Series 1 institutional proof model ──────────────────────────────────
    distributionsCount: recentDistributions.length,
    distributionsDeprioritized: true,
    series1Proof,
    reservePockets,
    proofFreshness: buildProofFreshness({
      coverage,
      attestation: latestAttestation,
      attestationVerified,
      custody,
      onChainEvents,
    }),
  };
}
