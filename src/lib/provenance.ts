// src/lib/provenance.ts
//
// CANONICAL provenance vocabulary — pure module (zero React, zero component
// import). Single source of truth for the 8 provenance kinds (non-negotiable
// #2: every metric carries a readable provenance), their labels + tooltip
// descriptions, and the honesty mappings (DataStatus → kind, txHash → kind).
//
// Both badge primitives consume this module:
//   - src/components/catalyst/provenance-badge.tsx (investor /proof-center)
//   - src/ui/badge.tsx ProvenanceBadge (admin views)
// The contract test src/ui/__tests__/provenance-contract.test.ts locks the two
// mappings to exactly these kinds and forbids `danger` on any of them (stale
// or simulated data is not an error — red on provenance is a doctrine breach).
//
// MIGRATION NOTES (vague 2, do not do here):
//   - src/lib/admin/kpi-strip-view.ts should become
//     `export type HeroKpiProvenance = Provenance` (same 8-kind union today).
//     Not aliased in THIS wave: that file belongs to the KPI presenter layer.
//   - src/features/investor-ui/format-btc.ts still exports its own
//     `toProvenance` (narrower BtcProvenanceKind) — now DEPRECATED in favour
//     of the copy below; investor consumers migrate in vague 2.
//   - src/views/admin/distributions-view.tsx and
//     src/components/proof-center/recent-distributions.tsx hand-roll the
//     0xMOCK detection — they adopt `txProvenance`/`isMockTxHash` in vague 2.

/** The 8 canonical provenance kinds, as rendered by both badge primitives. */
export const PROVENANCE_KINDS = [
  "live",
  "oracle",
  "attested",
  "estimated",
  "partial",
  "manual",
  "stale",
  "simulated",
] as const;

export type Provenance = (typeof PROVENANCE_KINDS)[number];

/** Human label shown inside the badge chip. */
export const PROVENANCE_LABELS: Record<Provenance, string> = {
  live: "Live",
  oracle: "Oracle",
  attested: "Attested",
  estimated: "Estimated",
  partial: "Partial",
  manual: "Manual",
  stale: "Stale",
  simulated: "Simulated",
};

/** Tooltip / title description for each kind. */
export const PROVENANCE_DESCRIPTIONS: Record<Provenance, string> = {
  live: "Real-time data from direct system integration",
  oracle: "Data verified by decentralized oracles",
  attested: "Data verified by third-party attestation",
  estimated: "Projection based on historical performance",
  partial: "Incomplete data from some sources",
  manual: "Data manually entered by administrators",
  stale: "Data awaiting update from source",
  simulated: "Demo sandbox data — not a production record",
};

/**
 * Maps a block's DataStatus to the closest provenance kind.
 * UNIFIED honesty mapping: "FIXTURE" → "simulated" (sandbox marker, never
 * mistaken for Live). Never returns "live" for anything but a real LIVE
 * status.
 *
 * Moved from src/features/investor-ui/format-btc.ts (same runtime behaviour,
 * widened return type) — the copy there is deprecated.
 */
export function toProvenance(status: string): Provenance {
  switch (status) {
    case "LIVE":
      return "live";
    case "STALE":
      return "stale";
    case "FIXTURE":
      return "simulated";
    case "PARTIAL":
      return "partial";
    default:
      return "estimated";
  }
}

/** Prefix (lowercased) marking a sandbox/fixture transaction hash. */
export const MOCK_TX_PREFIX = "0xmock";

/** True when a tx hash is a sandbox fixture (0xMOCK…, case-insensitive). */
export function isMockTxHash(txHash: string | null | undefined): boolean {
  return txHash != null && txHash.toLowerCase().startsWith(MOCK_TX_PREFIX);
}

/**
 * Canonical provenance of an on-chain transaction reference:
 *   - real hash       → "attested"  (verifiable on the explorer)
 *   - 0xMOCK… fixture → "simulated" (sandbox record — case-insensitive)
 *   - no hash         → "manual"    (recorded off-chain by an operator)
 *
 * Replaces the two hand-rolled detections (admin distributions view maps a
 * mock hash to "estimated" today; proof-center lowercases by hand). This is
 * the honest mapping: a 0xMOCK fixture IS sandbox data, not an estimate.
 */
export function txProvenance(txHash: string | null | undefined): Provenance {
  if (!txHash) return "manual";
  return isMockTxHash(txHash) ? "simulated" : "attested";
}
