// Demo builder — off-chain proof rows for /admin/proofs in demo mode.
//
// Returns a handful of plausible mining_attestation / custody rows whose
// shape is identical to what `prisma.proof.findMany` returns (ProofItem).
// Key invariants:
//   - txHash is always null   → no BaseScan link, no "attested" badge rendered
//   - hash uses DEMO_SENTINEL_HASH (one well-known sentinel) or clearly fake
//     padded values — never a real keccak digest
//   - uri is #demo so safeUrl() returns a safe no-op (not an external HTTPS)
//   - provenance is contextually "Simulated" (communicated via notes field)

import { DEMO_SENTINEL_HASH } from "@/lib/demo/markers";

export interface DemoProofRow {
  id: string;
  proofType: string;
  period: string | null;
  hash: string;
  uri: string;
  postedAt: Date;
  postedBy: string;
  notes: string | null;
  txHash: string | null;
}

const DEMO_POSTER = "0xDe000000000000000000000000000000000000Ad";

export function buildDemoProofRows(): DemoProofRow[] {
  return [
    {
      id: "demo-proof-001",
      proofType: "mining_attestation",
      period: "2026-05",
      hash: DEMO_SENTINEL_HASH,
      uri: "#demo",
      postedAt: new Date("2026-06-01T09:00:00.000Z"),
      postedBy: DEMO_POSTER,
      notes: "Simulated — May 2026 mining attestation. Not a live attestation.",
      txHash: null,
    },
    {
      id: "demo-proof-002",
      proofType: "mining_attestation",
      period: "2026-04",
      hash: "0xde11111111111111111111111111111111111111111111111111111111111111",
      uri: "#demo",
      postedAt: new Date("2026-05-01T09:00:00.000Z"),
      postedBy: DEMO_POSTER,
      notes: "Simulated — April 2026 mining attestation. Not a live attestation.",
      txHash: null,
    },
    {
      id: "demo-proof-003",
      proofType: "mining_attestation",
      period: "2026-03",
      hash: "0xde22222222222222222222222222222222222222222222222222222222222222",
      uri: "#demo",
      postedAt: new Date("2026-04-01T09:00:00.000Z"),
      postedBy: DEMO_POSTER,
      notes: "Simulated — March 2026 mining attestation. Not a live attestation.",
      txHash: null,
    },
    {
      id: "demo-proof-004",
      proofType: "custody",
      period: "2026-Q1",
      hash: "0xde33333333333333333333333333333333333333333333333333333333333333",
      uri: "#demo",
      postedAt: new Date("2026-04-05T12:00:00.000Z"),
      postedBy: DEMO_POSTER,
      notes: "Simulated — Q1 2026 custody attestation. Not a live attestation.",
      txHash: null,
    },
    {
      id: "demo-proof-005",
      proofType: "custody",
      period: "2025-Q4",
      hash: "0xde44444444444444444444444444444444444444444444444444444444444444",
      uri: "#demo",
      postedAt: new Date("2026-01-08T12:00:00.000Z"),
      postedBy: DEMO_POSTER,
      notes: "Simulated — Q4 2025 custody attestation. Not a live attestation.",
      txHash: null,
    },
  ];
}
