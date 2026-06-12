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

/** Invest form amounts — optional compact ($250k / $1.2M). */
export function formatUsdAmount(n: number, compact = false): string {
  if (compact && n >= 1_000_000) {
    return `$${(n / 1_000_000).toFixed(1)}M`;
  }
  if (compact && n >= 1_000) {
    return `$${(n / 1_000).toFixed(0)}k`;
  }
  return USD_FULL.format(n);
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

/** Parse USDC amount from query param (confirmed page). */
export function formatUsdcFromParam(raw: string | undefined): string {
  const n = raw ? parseInt(raw, 10) : NaN;
  if (isNaN(n) || n <= 0) return "—";
  return USD_FULL.format(n);
}

export function formatDateGb(d: Date): string {
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function buildDistributionIcsUri(title: string, date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`;
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hearst Connect//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${ymd}`,
    `DTEND;VALUE=DATE:${ymd}`,
    `SUMMARY:${title}`,
    "DESCRIPTION:Hearst Yield Vault — USDC distribution. Target projection based on stated assumptions.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}

export function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}
