import "server-only";

import { createPublicClient, getAddress, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const RPC_TIMEOUT_MS = 10_000;
const RPC_RETRY_COUNT = 3;

function getRpcUrl(): string {
  const url = process.env.NEXT_PUBLIC_CHAIN_RPC_URL;
  if (!url || url.trim().length === 0) return DEFAULT_RPC_URL;
  return url;
}

function build() {
  return createPublicClient({
    chain: baseSepolia,
    transport: http(getRpcUrl(), {
      timeout: RPC_TIMEOUT_MS,
      retryCount: RPC_RETRY_COUNT,
    }),
  });
}

// Inferred type from viem 2.x — avoids the dual-version `PublicClient` collision
// that surfaces when `@walletconnect/utils` pins an older viem.
export type ChainClient = ReturnType<typeof build>;

let cachedClient: ChainClient | null = null;

export function getPublicClient(): ChainClient {
  if (cachedClient === null) {
    cachedClient = build();
  }
  return cachedClient;
}

/**
 * Parse and checksum-validate an EVM address from env.
 *
 * Returns the EIP-55 checksummed address, or `null` when unset/blank. A value
 * that is present but malformed is treated as a configuration error and throws
 * — we never accept a typo'd address silently and let it fail opaquely inside a
 * later `readContract` call.
 *
 * `viem.getAddress` does the heavy lifting:
 *   - all-lowercase / all-uppercase input (the common `.env` case) → normalised
 *     to the canonical EIP-55 checksum, accepted.
 *   - mixed-case input with an INVALID checksum (a likely fat-finger typo) →
 *     throws, surfaced here as a clear config error.
 */
function parseAddress(raw: string | undefined): Address | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  if (!/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(
      `Invalid EVM address in environment: "${trimmed}". ` +
        "Expected a 0x-prefixed 40-hex address.",
    );
  }
  try {
    // getAddress validates the EIP-55 checksum and returns the canonical form.
    return getAddress(trimmed);
  } catch {
    throw new Error(
      `EVM address failed checksum validation: "${trimmed}". ` +
        "If this is a real address, supply it all-lowercase or with a correct " +
        "EIP-55 checksum — a mixed-case mismatch usually means a typo.",
    );
  }
}

export function getEventLoggerAddress(): `0x${string}` | null {
  return parseAddress(process.env.NEXT_PUBLIC_EVENT_LOGGER_ADDRESS);
}

export function getPoRRegistryAddress(): `0x${string}` | null {
  return parseAddress(process.env.NEXT_PUBLIC_POR_REGISTRY_ADDRESS);
}

export function getHearstPublisherAddress(): `0x${string}` | null {
  return parseAddress(process.env.HEARST_PUBLISHER);
}

export function isChainConfigured(): boolean {
  return getEventLoggerAddress() !== null && getPoRRegistryAddress() !== null;
}

// ---------------------------------------------------------------------------
// Block explorer — single source of truth, chain-aware
// ---------------------------------------------------------------------------
//
// The explorer domain is derived from the SAME chain we transact on
// (`baseSepolia`, imported above and used by `build()`), so the explorer can
// never drift away from the on-chain network. Today that is Base Sepolia
// (testnet) → sepolia.basescan.org. If/when the app is repointed at Base
// mainnet (chain id 8453), this map yields basescan.org automatically.
//
// IMPORTANT: components must NOT hardcode basescan URLs — import `explorerTxUrl`
// / `explorerAddressUrl` (or the `EXPLORER_*` constants below) instead.

const BASE_SEPOLIA_CHAIN_ID = 84532;
const BASE_MAINNET_CHAIN_ID = 8453;

/** Explorer base origin (no trailing slash) for a given chain id. */
function explorerOrigin(chainId: number): string {
  switch (chainId) {
    case BASE_MAINNET_CHAIN_ID:
      return "https://basescan.org";
    case BASE_SEPOLIA_CHAIN_ID:
    default:
      // Default to the Sepolia explorer — the chain we actually transact on.
      // Defaulting here (rather than throwing) keeps link rendering total even
      // if the chain config is ever widened; the on-chain calls themselves are
      // already pinned to `baseSepolia` in `build()`.
      return "https://sepolia.basescan.org";
  }
}

/** The chain id the app transacts on — kept in lockstep with `build()`'s chain. */
export const ACTIVE_CHAIN_ID: number = baseSepolia.id;

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

/** Block-explorer URL for a transaction hash on the active chain. */
export function explorerTxUrl(txHash: string): string {
  return `${explorerOrigin(ACTIVE_CHAIN_ID)}/tx/${txHash}`;
}

/** Block-explorer URL for an address on the active chain. */
function explorerAddressUrl(address: string): string {
  return `${explorerOrigin(ACTIVE_CHAIN_ID)}/address/${address}`;
}

// Backwards-compatible constants — now DERIVED from the chain-aware origin so
// the existing Proof Center consumers stay correct without edits. Prefer the
// `explorerTxUrl` / `explorerAddressUrl` helpers in new code.
export const EXPLORER_TX_BASE = `${explorerOrigin(ACTIVE_CHAIN_ID)}/tx/`;
export const EXPLORER_ADDRESS_BASE = `${explorerOrigin(ACTIVE_CHAIN_ID)}/address/`;
