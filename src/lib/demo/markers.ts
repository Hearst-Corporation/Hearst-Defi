// Centralized demo provider markers + copy.
//
// Single source of truth for the demo provider's markers, copy, and the
// demo→provenance mapping. Type-only import of `Provenance` keeps this module
// client-safe (no runtime pulled in by invest-form.tsx and friends).

import type { Provenance } from "@/components/ui/provenance-badge";

/**
 * Provenance shown for a demo value. In the demo sandbox EVERY value is
 * "simulated" (a neutral sandbox marker, not an alarm) regardless of what the
 * live loader would have resolved. Outside demo mode, the live provenance is
 * returned unchanged — so the live institutional flow is byte-identical.
 *
 * This is the single chokepoint for demo provenance: callers pass `isDemo` and
 * the provenance they would otherwise show, and never branch on demo inline.
 */
export function demoProvenance(isDemo: boolean, liveKind: Provenance): Provenance {
  return isDemo ? "simulated" : liveKind;
}

/**
 * Provenance for a PROOF in the demo sandbox. Demo proofs are "paper" (no real
 * on-chain attestation): in demo mode they render "simulated"; outside demo
 * mode the real resolved provenance (`liveKind`, typically "attested" |
 * "manual" | "stale") is returned unchanged. `proofSource` lets a future caller
 * special-case non-paper proof kinds without re-touching this signature.
 */
export function proofProvenance(
  isDemo: boolean,
  proofSource: string,
  liveKind: Provenance,
): Provenance {
  if (isDemo) return "simulated";
  return liveKind;
}

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

/** Title for the demo confirmed page (no real subscription was created). */
export const DEMO_CONFIRMED_TITLE = "Demo deposit simulated" as const;

/** Description for the demo confirmed page (sandbox / visual QA only). */
export const DEMO_CONFIRMED_DESCRIPTION =
  "No real subscription was created. This sandbox flow is for visual QA only." as const;

/**
 * Sentinel position id returned by the subscribe action's demo safety-net. It
 * is NOT a real DB row id — no `prisma.position.create` ran for it. Distinct
 * from the read-only demo dataset's `DEMO_POSITION_ID` so a no-op write can
 * never be confused with the seeded demo position.
 */
export const DEMO_SUBSCRIBE_NOOP_POSITION_ID = "demo-noop-no-subscription" as const;
