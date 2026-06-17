// src/lib/onchain/index.ts
//
// Shared types and display utilities for on-chain interactions.
//
// Real viem helpers (approve, deposit) live in ./vault.ts.
// This file intentionally contains NO stubs — stubs have been removed.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EpochStatus = "ACTIVE" | "ENDING" | "SYNC";

// ---------------------------------------------------------------------------
// Display utilities
// ---------------------------------------------------------------------------

/** Abbreviate wallet address for display: 0xABCD…EF12 */
export function abbreviateAddress(address: string): string {
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
