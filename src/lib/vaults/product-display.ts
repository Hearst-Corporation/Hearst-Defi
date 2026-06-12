// LP product-surface formatters — pure, no I/O.

const USD_COMPACT = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function formatMinTicketUsdc(usdc: number): string {
  if (usdc >= 1_000_000) {
    return `$${(usdc / 1_000_000).toFixed(usdc % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `$${(usdc / 1_000).toFixed(0)}k`;
}

export function formatUsdCompact(usdc: number): string {
  return USD_COMPACT.format(usdc);
}

export function formatUsdFull(usdc: number): string {
  return USD_FULL.format(usdc);
}

export function formatFeeLine(fees: VaultProductFees): string {
  const mgmtPct = (fees.mgmtBps / 100).toFixed(2);
  const perfPct = (fees.perfBps / 100).toFixed(0);
  const hurdlePct = (fees.hurdleBps / 100).toFixed(0);
  return `${mgmtPct}% · ${perfPct}%${fees.hurdleBps > 0 ? ` (${hurdlePct}% hurdle)` : ""}`;
}

interface VaultProductFees {
  mgmtBps: number;
  perfBps: number;
  hurdleBps: number;
}

export function shareClassCode(
  shareClass: string,
): "A" | "B" {
  return shareClass === "B" ? "B" : "A";
}
