import { baseSepolia } from "viem/chains";

/**
 * Recognises fabricated/placeholder tx hashes used by local seed + demo
 * fixtures. These hashes are intentionally NOT real on-chain transactions, so
 * the UI must never render an explorer link to them (it would 404 on BaseScan).
 *
 * Sentinel prefixes (after the 0x):
 *   - "feed…" — investor-demo fixtures (src/lib/dev/investor-demo.ts)
 *   - "5eed…" — admin distribution seed fixtures (prisma/seed.ts), reads as "seed"
 *   - "mock…" — fabricated mock-attestation hashes (the B4 convention:
 *     `distributionBadgeKind` treats a `0xmock…` hash as estimated/manual, never
 *     attested), so they must likewise never render a BaseScan link.
 *
 * A null/empty hash is also treated as "no link" (already handled by callers,
 * but covered here so a single guard suffices).
 */
export function isPlaceholderTxHash(txHash: string | null | undefined): boolean {
  if (!txHash) return true;
  const lower = txHash.toLowerCase();
  return (
    lower.startsWith("0xfeed") ||
    lower.startsWith("0x5eed") ||
    lower.startsWith("0xmock")
  );
}

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

/** Explorer base origin (no trailing slash) for a given chain id. */
function explorerOrigin(chainId: number): string {
  switch (chainId) {
    case BASE_MAINNET_CHAIN_ID:
      return "https://basescan.org";
    case BASE_SEPOLIA_CHAIN_ID:
    default:
      return "https://sepolia.basescan.org";
  }
}

/** The chain id the app transacts on — kept in lockstep with `build()`'s chain. */
export const ACTIVE_CHAIN_ID: number = baseSepolia.id;

/** Block-explorer URL for a transaction hash on the active chain. */
export function explorerTxUrl(txHash: string): string {
  return `${explorerOrigin(ACTIVE_CHAIN_ID)}/tx/${txHash}`;
}

export const EXPLORER_TX_BASE = `${explorerOrigin(ACTIVE_CHAIN_ID)}/tx/`;
export const EXPLORER_ADDRESS_BASE = `${explorerOrigin(ACTIVE_CHAIN_ID)}/address/`;
