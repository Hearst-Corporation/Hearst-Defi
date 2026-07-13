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

import { formatBtc as formatBtcCanonical } from "@/lib/format/btc";
import { formatUsdCompact } from "@/lib/format/usd-compact";

export { formatUsdCompact };

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

/**
 * Thin wrapper over the canonical BTC formatter (@/lib/format/btc), pinned to
 * this module's legacy precision (max 4dp, " BTC" suffix). Realistic inputs
 * here (period-mined BTC) stay well under 100, so the canonical adaptive
 * ceiling never engages — output is unchanged from the pre-consolidation
 * `Intl.NumberFormat(maximumFractionDigits: 4)` implementation.
 */
export function formatBtc(value: number): string {
  return formatBtcCanonical(value, { unit: true, maxDp: 4 });
}

export function isOlderThan24h(ts: Date): boolean {
  return Date.now() - ts.getTime() > STALE_MS;
}

export function resolveAttestationProvenance(
  timestamp: Date,
  verified: boolean,
  isDemo = false,
): "attested" | "stale" | "simulated" {
  if (isDemo) return "simulated";
  return !isOlderThan24h(timestamp) && verified ? "attested" : "stale";
}

/** Strip admin rejection suffix from rebalance trigger copy. */
export function cleanRebalanceTriggerText(text: string): string {
  return text.replace(/\s*\[REJECTED:.*\]$/, "");
}

export function statusVariant(
  status: string,
): "default" | "success" | "warning" | "danger" | "brand" {
  switch (status) {
    case "pending":
      return "warning";
    case "approved":
      return "brand";
    case "executed":
      return "success";
    case "cancelled":
      return "danger";
    default:
      return "default";
  }
}

