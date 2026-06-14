// Centralized demo provider markers + copy.
//
// Not wired to any UI or loader in this lot — these are the single source of
// truth for when the provider is branched later.
//
// NOTE: DEMO_SOURCE is a DATA-SOURCE marker stamped on demo payloads. It is NOT
// a ProvenanceBadge `Provenance` value (the badge union does not include
// "demo"). Mapping demo payloads to a visible provenance badge is a Lot 2
// decision and may require extending the Provenance union.

export const DEMO_SOURCE = "demo" as const;

export const DEMO_SANDBOX_LABEL = "Demo Sandbox" as const;

export const DEMO_SANDBOX_DISCLAIMER =
  "Demo data. Not live. No real subscription." as const;

/**
 * Sentinel digest for the demo sandbox. Spelled `0xde…0` and padded with zeros
 * so it reads as obviously fabricated, never a meaningful hash. It is used ONLY
 * as a document digest (`proof.hash`) on the read-only demo proofs — those
 * proofs always carry `txHash: null`, so the demo never claims an on-chain
 * settlement. The demo INVEST flow presents no transaction hash at all (the
 * confirmed page suppresses the explorer/hash entirely). Single source of truth
 * for "this is sandbox demo data, not a real settled transaction".
 */
export const DEMO_SENTINEL_HASH =
  "0xde00000000000000000000000000000000000000000000000000000000000000" as const;

/** CTA label shown on the demo invest form (no wallet/chain effect behind it). */
export const DEMO_INVEST_CTA_LABEL = "Simulate deposit →" as const;

/**
 * Sentinel position id returned by the subscribe action's demo safety-net. It
 * is NOT a real DB row id — no `prisma.position.create` ran for it. Distinct
 * from the read-only demo dataset's `DEMO_POSITION_ID` so a no-op write can
 * never be confused with the seeded demo position.
 */
export const DEMO_SUBSCRIBE_NOOP_POSITION_ID = "demo-noop-no-subscription" as const;
