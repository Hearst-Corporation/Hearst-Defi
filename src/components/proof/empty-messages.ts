export const POR_ATTESTATION_EMPTY = {
  message: "No on-chain Proof of Reserves attestation yet.",
  detail:
    "Contracts are live on Base Sepolia (testnet) — the publisher will post the first attestation after the initial vault period closes.",
} as const;

export const EVENT_TIMELINE_EMPTY = {
  message: "No on-chain events yet.",
  detail: "Contracts are live on Base Sepolia (testnet) — events appear here as the vault operates.",
} as const;

export const PLATFORM_PROOFS_EMPTY = {
  message: "No proofs published yet",
  detail:
    "Off-chain attestations, custody snapshots, and audits will appear here once posted. On-chain entries are read live from Base Sepolia (testnet).",
} as const;

export function filteredProofsEmpty(filter: string): { message: string; detail: string } {
  return {
    message: `No ${filter} proofs published yet.`,
    detail: "Try a different filter or check back as new attestations are published.",
  };
}

export function unfilteredProofsEmpty(): { message: string; detail: string } {
  return {
    message: "No proofs published yet.",
    detail: "Proofs (audits, custody attestations, on-chain events) will appear here once published.",
  };
}

export const OFF_CHAIN_PROOFS_EMPTY = {
  message: "No off-chain proofs published yet.",
  detail: "Mining attestations and custody snapshots appear here once posted via the ingest CLI.",
} as const;

export const MINING_CASHFLOW_COPY = {
  live: "Coverage calculated from complete mining cash-flow inputs.",
  estimated: "Estimated from available (demo/staging) mining inputs. Not attested.",
  pending: "Coverage pending until mining cash-flow inputs are attested.",
  invalid: "Coverage unavailable — mining cash-flow inputs are invalid.",
} as const;
