// Demo builders for the /admin/proof-center page.
//
// Pure, deterministic, no I/O, no Prisma, no SDK. Called only when
// canRunDemoProvider() returns true (non-production + DEMO_PROVIDER_ENABLED=1).
//
// Honesty rules:
//   - custody provenance is ALWAYS "manual" (never "live" or "attested")
//   - on-chain attestations and events carry txHash/blockNumber sentinel values,
//     never real Base Sepolia hashes
//   - no attestor address is an allowlisted real address
//   - proof items carry txHash: null and attestationVerified: null
//   - the demo banner is surfaced by the page independently (databaseHasDemoProofs
//     stub returns true when canRunDemoProvider is on)

import type { OnChainAttestation } from "@/lib/chain/por-registry";
import type { OnChainEvent, EventKind } from "@/lib/chain/event-logger";
import type { CustodySnapshot } from "@/lib/data/custody";
import type { ProofItem } from "@/lib/proof-center-types";
import type { PaginatedResult } from "@/lib/pagination";
import { DEMO_SENTINEL_HASH } from "@/lib/demo/markers";

// ---------------------------------------------------------------------------
// Shared demo constants — match the dashboard capital anchor (25_000_000 USDC)
// ---------------------------------------------------------------------------

const DEMO_CAPITAL_USDC = 25_000_000 as const;
const DEMO_PROOF_PERIOD = "2026-05" as const;

/** Sentinel on-chain tx hash: readable as obviously fabricated demo data. */
const DEMO_TX_HASH =
  "0xde00000000000000000000000000000000000000000000000000000000000001" as const satisfies `0x${string}`;

/** Sentinel context hash for EventLogger events. */
const DEMO_CONTEXT_HASH =
  "0xde00000000000000000000000000000000000000000000000000000000000002" as const satisfies `0x${string}`;

/** Sentinel evidence hash for PoR attestations. */
const DEMO_EVIDENCE_HASH =
  "0xde00000000000000000000000000000000000000000000000000000000000003" as const satisfies `0x${string}`;

/**
 * Demo attestor — a visually obvious sentinel, NOT an allowlisted real address.
 * `isAttestorAllowlisted` will return false for this value, so `latestAttestationVerified`
 * stays false and no "Attested" badge appears.
 */
const DEMO_ATTESTOR_ADDRESS =
  "0xde00000000000000000000000000000000000000" as const satisfies `0x${string}`;

/**
 * Stable "now" anchor for demo data. Captured once at module load so all
 * builders in the same request share the same timestamp — truly deterministic
 * within a module lifetime.
 */
const DEMO_NOW = new Date();

function demoNow(): Date {
  return DEMO_NOW;
}

// ---------------------------------------------------------------------------
// loadCustody demo branch
// ---------------------------------------------------------------------------

/**
 * Returns a CustodySnapshot for the demo sandbox.
 *
 * provenance = "manual" — NEVER "live" (no Fireblocks call happened).
 * configured = false — scope is not pinned.
 * totalUsdcReserves = 25_000_000 — matches the dashboard capital anchor.
 */
export function buildDemoCustody(): CustodySnapshot {
  const now = demoNow();
  return {
    provenance: "manual",
    configured: false,
    asOf: now.toISOString(),
    accountsCount: 1,
    totalUsdcReserves: DEMO_CAPITAL_USDC,
    accounts: [
      {
        id: "demo-vault-account-86",
        name: "Hearst Connect (Demo)",
        assets: [
          { assetId: "USDC", total: DEMO_CAPITAL_USDC },
        ],
        usdcTotal: DEMO_CAPITAL_USDC,
      },
    ],
  };
}

// ---------------------------------------------------------------------------
// fetchOnChainAttestations demo branch
// ---------------------------------------------------------------------------

/**
 * Returns simulated PoR attestations for the demo sandbox.
 *
 * - attestor = sentinel (NOT allowlisted → verified = false)
 * - txHash = demo sentinel (not a real Base Sepolia hash)
 * - AUM matches the dashboard capital anchor (25 M USDC = 25_000_000_000_000 base units)
 * - provenance reads as "simulated", not "attested"
 */
export function buildDemoOnChainAttestations(): OnChainAttestation[] {
  const now = demoNow();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

  // 25_000_000 USDC in 6-decimal base units
  const rawAumUsdc = 25_000_000_000_000n;
  // 3.2 BTC in sats (demo mining output)
  const rawMinedBtcSats = 320_000_000n;

  return [
    {
      attestationId: 1n,
      period: 202605n,
      attestor: DEMO_ATTESTOR_ADDRESS,
      totalAumUsd: 25_000_000,
      minedBtc: 3.2,
      rawTotalAumUsd: rawAumUsdc,
      rawMinedBtcSats: rawMinedBtcSats,
      evidenceHash: DEMO_EVIDENCE_HASH,
      evidenceCid: "demo-cid-por-2026-05",
      timestamp: thirtyDaysAgo,
      txHash: DEMO_TX_HASH,
      blockNumber: 0n,
    },
  ];
}

// ---------------------------------------------------------------------------
// fetchOnChainEvents demo branch
// ---------------------------------------------------------------------------

/**
 * Returns simulated on-chain EventLogger events for the demo sandbox.
 *
 * Events cover the canonical lifecycle: Distribution + Rebalance.
 * txHash = demo sentinel (not real), blockNumber = 0n (demo).
 * publisher = DEMO_ATTESTOR_ADDRESS (not the authorized publisher → no filter issue
 * in demo mode since we bypass fetchOnChainEvents entirely).
 */
export function buildDemoOnChainEvents(): OnChainEvent[] {
  const now = demoNow();
  const oneMonthAgo = new Date(now.getTime() - 30 * 86_400_000);
  const twoMonthsAgo = new Date(now.getTime() - 60 * 86_400_000);

  const events: Array<{
    eventId: bigint;
    kind: EventKind;
    contextHash: `0x${string}`;
    publisher: `0x${string}`;
    timestamp: Date;
    payloadCid: string;
    txHash: `0x${string}`;
    blockNumber: bigint;
  }> = [
    {
      eventId: 3n,
      kind: "Distribution",
      contextHash: DEMO_CONTEXT_HASH,
      publisher: DEMO_ATTESTOR_ADDRESS,
      timestamp: oneMonthAgo,
      payloadCid: "demo-cid-distribution-2026-05",
      txHash: DEMO_TX_HASH,
      blockNumber: 0n,
    },
    {
      eventId: 2n,
      kind: "Rebalance",
      contextHash: DEMO_CONTEXT_HASH,
      publisher: DEMO_ATTESTOR_ADDRESS,
      timestamp: twoMonthsAgo,
      payloadCid: "demo-cid-rebalance-2026-04",
      txHash: DEMO_TX_HASH,
      blockNumber: 0n,
    },
    {
      eventId: 1n,
      kind: "AttestationPublished",
      contextHash: DEMO_CONTEXT_HASH,
      publisher: DEMO_ATTESTOR_ADDRESS,
      timestamp: twoMonthsAgo,
      payloadCid: "demo-cid-attestation-2026-04",
      txHash: DEMO_TX_HASH,
      blockNumber: 0n,
    },
  ];

  return events;
}

// ---------------------------------------------------------------------------
// getProofs demo branch
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Paper proofs — admin proof-center grid (PaginatedResult)
//
// LP investor session uses `buildDemoProofs()` in demo/builders.ts (ProofItem[]).
// Admin CRUD library uses `buildDemoProofRows()` in demo/admin/proofs.ts.
// Same name, different shapes — do not import across surfaces without renaming.
// ---------------------------------------------------------------------------

/**
 * Returns simulated paper proof rows for the demo sandbox.
 *
 * - txHash: null (no on-chain claim)
 * - attestationVerified: null (no signature to verify)
 * - hash: DEMO_SENTINEL_HASH (visually fabricated)
 * - provenance is "manual"/"simulated" via the postedBy label
 */
export function buildDemoProofs(): PaginatedResult<ProofItem> {
  const postedAt = demoNow().toISOString();

  const items: ProofItem[] = [
    {
      id: "demo-proof-mining",
      proofType: "mining_attestation",
      period: DEMO_PROOF_PERIOD,
      title: `Mining attestation · ${DEMO_PROOF_PERIOD}`,
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/mining-2026-05",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-custody",
      proofType: "custody",
      period: DEMO_PROOF_PERIOD,
      title: `Custody proof-of-reserves snapshot · ${DEMO_PROOF_PERIOD}`,
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/custody-2026-05",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-audit",
      proofType: "audit",
      period: null,
      title: "Audit report",
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/audit",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
    {
      id: "demo-proof-methodology",
      proofType: "methodology",
      period: null,
      title: "Methodology document",
      hash: DEMO_SENTINEL_HASH,
      uri: "https://demo.invalid/proofs/methodology-v1",
      postedAt,
      postedBy: "Demo Sandbox",
      txHash: null,
      signer: null,
      attestationVerified: null,
    },
  ];

  return {
    data: items,
    total: items.length,
    page: 1,
    pageSize: 50,
    hasMore: false,
  };
}
