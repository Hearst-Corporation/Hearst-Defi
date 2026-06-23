/**
 * Truncate a wallet address to 0x…abcd format (6 chars + last 4).
 * Falls back to first 10 chars for non-hex strings.
 * Handles null/empty by returning em dash ("—").
 */
export function truncateWallet(addr: string | null): string {
  if (!addr) return "—";
  if (addr.startsWith("0x") && addr.length >= 10) {
    return `${addr.slice(0, 4)}…${addr.slice(-4)}`;
  }
  return addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}
