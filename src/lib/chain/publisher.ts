import "server-only";

import { createWalletClient, http, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

import { readServerEnv } from "@/lib/env";

/**
 * Shared signer seam for all on-chain write paths.
 *
 * Both EventLogger and PoRRegistry writers gate through this module so key
 * validation, wallet construction, and the "disarmed" exit path live in one
 * place rather than being duplicated per-writer.
 *
 * The key is read from HEARST_PUBLISHER_PRIVATE_KEY on every call (no
 * module-level caching) so the process can be started without the key and
 * the writes will simply no-op — safe for all non-signing environments.
 *
 * Testnet-only: wallet is always wired to `baseSepolia`.
 */

/**
 * Returns the validated publisher private key, or null.
 *
 * - Absent / blank → null (silently disarmed).
 * - Present but malformed (not `0x` + 64 hex) → console.warn + null.
 * - Valid → returned as-is.
 */
export function getPublisherPrivateKey(): `0x${string}` | null {
  // LIVE read via the canon helper on every call (documented contract above:
  // no module-level caching). NEVER log or expose the returned value.
  const raw = readServerEnv("HEARST_PUBLISHER_PRIVATE_KEY");
  if (!raw || raw.trim().length === 0) return null;

  const trimmed = raw.trim();
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    console.warn(
      "[chain/publisher] HEARST_PUBLISHER_PRIVATE_KEY malformed — on-chain writes disarmed",
    );
    return null;
  }

  return trimmed as `0x${string}`;
}

/**
 * Returns true when a valid publisher key is present and the on-chain write
 * loop is operational.
 */
export function isPublisherArmed(): boolean {
  return getPublisherPrivateKey() !== null;
}

/**
 * Builds and returns a viem WalletClient for the publisher account on Base
 * Sepolia, or null when disarmed / construction fails.
 *
 * Never throws — any failure is console.warn'd and returns null so callers
 * don't need to guard.
 */
export function getPublisherWalletClient(): WalletClient | null {
  const key = getPublisherPrivateKey();
  if (!key) return null;

  const rpcUrl =
    readServerEnv("NEXT_PUBLIC_CHAIN_RPC_URL")?.trim() || "https://sepolia.base.org";

  try {
    const account = privateKeyToAccount(key);
    return createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(rpcUrl),
    });
  } catch (err) {
    console.warn(
      "[chain/publisher] getPublisherWalletClient failed:",
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}
