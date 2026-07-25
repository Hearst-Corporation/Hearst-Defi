import "server-only";

import { createPublicClient, getAddress, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";

import { readServerEnv } from "@/lib/env";
import {
  ACTIVE_CHAIN_ID,
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
  explorerTxUrl,
  isPlaceholderTxHash,
} from "./explorer";

const DEFAULT_RPC_URL = "https://sepolia.base.org";
const RPC_TIMEOUT_MS = 10_000;
const RPC_RETRY_COUNT = 3;

function getRpcUrl(): string {
  // LIVE reads via the canon helper throughout this module — the unit tests
  // (client.test / writes.test) set and delete these vars per test.
  const url = readServerEnv("NEXT_PUBLIC_CHAIN_RPC_URL");
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
  return parseAddress(readServerEnv("NEXT_PUBLIC_EVENT_LOGGER_ADDRESS"));
}

export function getPoRRegistryAddress(): `0x${string}` | null {
  return parseAddress(readServerEnv("NEXT_PUBLIC_POR_REGISTRY_ADDRESS"));
}

export function getHearstPublisherAddress(): `0x${string}` | null {
  return parseAddress(readServerEnv("HEARST_PUBLISHER"));
}

export function isChainConfigured(): boolean {
  return getEventLoggerAddress() !== null && getPoRRegistryAddress() !== null;
}

export {
  ACTIVE_CHAIN_ID,
  EXPLORER_ADDRESS_BASE,
  EXPLORER_TX_BASE,
  explorerTxUrl,
  isPlaceholderTxHash,
};
