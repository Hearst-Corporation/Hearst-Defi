// Series 1 proof-block provenance — PURE module (type-only imports, zero I/O,
// no server-only). Extracted from hub-data.ts (mission E5) so the honesty
// rules are directly testable and reusable by any surface without pulling
// Prisma/chain clients into the bundle.
//
// These are the CANON rules the Proof Center hub badges follow:
//   - absence of a source is "stale" ("awaiting update from source") — NEVER
//     "manual", which would claim a human keyed the value in;
//   - row count is not freshness: old evidence is "stale", not "live";
//   - a composite is only as good as its weakest contributing source.

import type { CoverageView } from "@/lib/engine/coverage-view";
import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { OnChainEvent } from "@/lib/chain/event-logger";
import type { CustodySnapshot } from "@/lib/data/custody";
import type { ProofCenterDistributionRow } from "@/lib/data/proof-center";

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

export const STALE_MS = 24 * 60 * 60 * 1000;

export function isStale(iso: string | null): boolean {
  if (!iso) return true;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return true;
  return Date.now() - t > STALE_MS;
}

/**
 * Provenance for an event-backed block. Existence of rows is NOT freshness:
 * a six-month-old event is evidence that something happened, not evidence the
 * source is live. So "live" requires BOTH rows and a fresh newest row.
 *
 * An empty list is not "manual" either — "manual" claims a human keyed the
 * value in, which is a stronger (and false) claim than "we have nothing".
 * Absence and age both resolve to "stale" ("awaiting update from source"),
 * the only term in the existing vocabulary that claims nothing.
 */
export function eventBlockProvenance(
  count: number,
  latestIso: string | null,
): ProofBlockProvenance {
  if (count === 0) return "stale";
  return isStale(latestIso) ? "stale" : "live";
}

/**
 * Worst-field-first composite, mirroring `precedenceWorst` in
 * `features/investor-ui/data-source/backend-data-source.ts`: a composite status
 * is only as good as its weakest contributing source. Implemented as an AND
 * over the sources that actually exist — a source that is absent (null) is not
 * a fresh source and must never count as a positive vote. When no source
 * contributes at all there is nothing to be fresh about, so the answer is
 * "stale", never "live".
 */
export function compositeFreshness(
  contributions: readonly (string | null)[],
): ProofBlockProvenance {
  const present = contributions.filter((iso): iso is string => iso !== null);
  if (present.length === 0) return "stale";
  return present.every((iso) => !isStale(iso)) ? "live" : "stale";
}

/**
 * Mining coverage block provenance. `pending` (inputs not yet supplied) and a
 * missing view both have NOTHING to show — that is "stale" (awaiting update
 * from source), never "manual": "manual" claims a human entered the figure,
 * which is false for an empty pipeline. This aligns the coverage rule with
 * `attestationBlockProvenance` / `custodyBlockProvenance` below (E5 fix — the
 * old default branch said "manual").
 */
export function coverageBlockProvenance(
  coverage: CoverageView,
): ProofBlockProvenance {
  switch (coverage?.provenance) {
    case "live":
      return "live";
    case "estimated":
      return "estimated";
    case "invalid":
      return "stale";
    default:
      // "pending" or no coverage view at all — claim nothing.
      return "stale";
  }
}

export function attestationBlockProvenance(
  attestation: OnChainAttestation | null,
  verified: boolean,
): ProofBlockProvenance {
  // No attestation is "nothing to show", not "a human entered this".
  if (!attestation) return "stale";
  if (isStale(attestation.timestamp.toISOString())) return "stale";
  return verified ? "attested" : "oracle";
}

export function custodyBlockProvenance(
  custody: CustodySnapshot | null,
): ProofBlockProvenance {
  // No snapshot at all — claim nothing rather than implying manual entry.
  if (!custody) return "stale";
  // Upstream outage / not configured. `loadCustody` reports this explicitly as
  // "unavailable"; it is not manual data entry and not an aged reading, but the
  // block-level vocabulary has no "unavailable" term, so it maps to the only
  // non-claiming option. `state: "absent"` carries the honest empty rendering.
  if (custody.provenance === "unavailable") return "stale";
  // "live" must survive the age check like every other source: a live-flagged
  // snapshot whose `asOf` has aged past the threshold is stale, not live.
  if (custody.provenance === "live" && custody.configured) {
    return isStale(custody.asOf) ? "stale" : "live";
  }
  return "manual";
}

/**
 * On-chain event kinds that evidence take-profit / curtailment operations for
 * the Series 1 mining note. `Rebalance` covers pocket take-profit sweeps; `ModeChange`
 * covers curtailment mode transitions; `GuardrailBreach` / `TriggerArmed` are
 * curtailment guardrails. `Distribution` here is on-chain *settlement*, not a
 * periodic cash distribution.
 */
export const TAKE_PROFIT_CURTAILMENT_KINDS = new Set([
  "Rebalance",
  "ModeChange",
  "GuardrailBreach",
  "TriggerArmed",
]);

/**
 * Build the ordered institutional proof blocks from already-fetched sources.
 * Pure over its inputs — every block reports honest presence + provenance, no
 * fabrication when a source is missing.
 *
 * NOT WIRED to a product surface yet (mission E5): kept exported + tested as
 * the reference implementation for the shared investor/admin proof rail —
 * wiring it into the hub UI is a shared-surface chantier (see mission report).
 */
export function buildSeries1Proof(input: {
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
  // Custody is "present" only when a live snapshot actually measured reserves
  // above zero. `totalUsdcReserves` is now nullable upstream: `null` means "not
  // measured" (outage / not configured) while `0` is a real reading. Comparing
  // null with `> 0` would coerce to false by accident rather than by intent, so
  // the null case is excluded explicitly.
  const custodyReserves = custody?.totalUsdcReserves ?? null;
  const custodyPresent =
    custody !== null &&
    custody.provenance === "live" &&
    custodyReserves !== null &&
    custodyReserves > 0;
  // Evidence count must never turn "we could not look" into "we looked and
  // found nothing". `accountsCount === null` is the outage signal, and a
  // non-live snapshot carries no verified count either. Both report 0 evidence
  // alongside `state: "absent"`, which claims nothing in either direction.
  const custodyEvidenceCount =
    custody?.provenance === "live" ? (custody.accountsCount ?? 0) : 0;

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
      evidenceCount: custodyEvidenceCount,
    },
    {
      kind: "delivery",
      title: "Proof of Delivery",
      eyebrow: "BTC settlement at maturity",
      provenance: eventBlockProvenance(deliveryEvents.length, latestDeliveryTs),
      // Series 1 delivers BTC at maturity — before then, honestly absent.
      state: deliveryEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestDeliveryTs,
      evidenceCount: deliveryEvents.length,
    },
    {
      kind: "contract-events",
      title: "Contract Events",
      eyebrow: "On-chain event log",
      provenance: eventBlockProvenance(onChainEvents.length, latestEventTs),
      state: onChainEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestEventTs,
      evidenceCount: onChainEvents.length,
    },
    {
      kind: "take-profit-curtailment",
      title: "Take-profit & Curtailment",
      eyebrow: "Vault operations",
      provenance: eventBlockProvenance(takeProfitEvents.length, latestTakeProfitTs),
      state: takeProfitEvents.length > 0 ? "present" : "absent",
      lastUpdated: latestTakeProfitTs,
      evidenceCount: takeProfitEvents.length,
    },
    {
      kind: "freshness",
      title: "Proof Freshness",
      eyebrow: "Source recency",
      // Freshness is derived meta over every contributing source. It follows the
      // WORST source, not the freshest: this badge is the one place a reader
      // looks to know whether the whole proof rail can be trusted right now, so
      // a single fresh source must not mask two stale ones. `custody.asOf` is
      // only offered as a contribution when the snapshot is actually live — a
      // degraded fallback stamps `asOf` with `Date.now()`, which would otherwise
      // look permanently fresh and silently vote "live".
      provenance: compositeFreshness([
        attestationTs,
        latestEventTs,
        custody?.provenance === "live" ? custody.asOf : null,
      ]),
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

/**
 * Proof-freshness timeline across every source, with honest staleness.
 * Pure — same wiring status as {@link buildSeries1Proof}.
 */
export function buildProofFreshness(input: {
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
      // Same rule as the proof blocks: row count is not freshness. Without this
      // the row could render "Live" next to its own `stale: true` flag.
      provenance: eventBlockProvenance(onChainEvents.length, eventTs),
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

/**
 * Reserve pocket coverage (B1/B2/B3) — which pockets have a live source.
 * Pure — same wiring status as {@link buildSeries1Proof}.
 */
export function buildReservePockets(input: {
  coverage: CoverageView;
  attestation: OnChainAttestation | null;
  custody: CustodySnapshot | null;
}): ReservePocketCoverage {
  const { coverage, attestation, custody } = input;
  return {
    b1Evidenced: coverage?.provenance === "live" || coverage?.provenance === "estimated",
    b2Evidenced: attestation !== null,
    // Same nullable-reserves rule as `custodyPresent` in buildSeries1Proof: an
    // unmeasured reserve (null) is not evidence of a pocket, and must not be
    // read as zero.
    b3Evidenced:
      custody !== null &&
      custody.provenance === "live" &&
      custody.totalUsdcReserves !== null &&
      custody.totalUsdcReserves > 0,
  };
}
