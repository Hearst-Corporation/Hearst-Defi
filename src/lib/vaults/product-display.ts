// LP product-surface formatters — pure, no I/O.

import { formatUsdCompact } from "@/lib/format/usd-compact";

export { formatUsdCompact };

const USD_FULL = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const USDC_GROUPED = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
  useGrouping: true,
});

const USD_DETAILED = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMinTicketUsdc(usdc: number): string {
  if (usdc >= 1_000_000) {
    return `$${(usdc / 1_000_000).toFixed(usdc % 1_000_000 === 0 ? 0 : 1)}M`;
  }
  return `$${(usdc / 1_000).toFixed(0)}k`;
}

export function formatUsdFull(usdc: number): string {
  return USD_FULL.format(usdc);
}

/** Position detail / accrued yield — two decimal places. */
export function formatUsdDetailed(usdc: number): string {
  return USD_DETAILED.format(usdc);
}

/** Portfolio USDC labels — full currency ($358,000). */
export const formatUsdcAmount = formatUsdFull;

/** Grouped integer without currency symbol (time-to-cash widget). */
export function formatUsdcGrouped(amount: number): string {
  return USDC_GROUPED.format(Math.round(amount));
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

const ADMIN_DATE = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

/** Admin tables — date-only (no time). */
export function formatAdminDate(d: Date): string {
  return ADMIN_DATE.format(d);
}

const ADMIN_DATETIME = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

/** Admin tables / audit — locale-stable datetime. */
export function formatAdminDateTime(d: Date): string {
  return ADMIN_DATETIME.format(d);
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
