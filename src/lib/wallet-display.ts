/**
 * Truncate a wallet address to 0x…abcd format (6 chars + last 4).
 * Falls back to first 10 chars for non-hex strings.
 */
export function truncateWallet(addr: string): string {
  if (addr.startsWith("0x") && addr.length >= 10) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }
  return addr.length > 12 ? `${addr.slice(0, 10)}…` : addr;
}
