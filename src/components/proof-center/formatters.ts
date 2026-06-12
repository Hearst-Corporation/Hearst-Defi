const dateCompactFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeUtcFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "UTC",
  hour12: false,
});

import { formatUsdCompact } from "@/lib/format/usd-compact";

export { formatUsdCompact };

const btcFmt = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 4,
});

const STALE_MS = 24 * 60 * 60 * 1000;

export function formatNestedTimestamp(date: Date): { value: string; sublabel: string } {
  return {
    value: dateCompactFmt.format(date),
    sublabel: `${timeUtcFmt.format(date)} UTC`,
  };
}

export function formatPorPeriod(period: bigint): string {
  const raw = period.toString();
  if (raw.length !== 6) return raw;
  return `${raw.slice(0, 4)}-${raw.slice(4)}`;
}

export function formatBtc(value: number): string {
  return `${btcFmt.format(value)} BTC`;
}

export function isOlderThan24h(ts: Date): boolean {
  return Date.now() - ts.getTime() > STALE_MS;
}

export function resolveAttestationProvenance(
  timestamp: Date,
  verified: boolean,
): "attested" | "stale" {
  return !isOlderThan24h(timestamp) && verified ? "attested" : "stale";
}

