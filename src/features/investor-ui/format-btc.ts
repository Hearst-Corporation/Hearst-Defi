// src/features/investor-ui/format-btc.ts
//
// Shared pure display formatters + honesty mapping for the investor UI
// (Dashboard + /btc + shared panels). No business logic — string formatting
// only.

/** "612000000" sats -> "6.12000000" BTC (decimal string in, decimal string out). */
export function satsToBtcString(sats: string, precision = 8): string {
  const n = Number(sats);
  if (!Number.isFinite(n)) return "0";
  return (n / 100_000_000).toFixed(precision);
}

/** "6.12000000" -> "6.12 BTC" (trims to 2dp for headline display). */
export function formatBtcAmount(btcDecimalString: string, precision = 2): string {
  const n = Number(btcDecimalString);
  if (!Number.isFinite(n)) return "0.00 BTC";
  return `${n.toFixed(precision)} BTC`;
}

/** Basis points -> "33.0%". */
export function formatBps(bps: number, precision = 1): string {
  return `${(bps / 100).toFixed(precision)}%`;
}

/** USDC decimal string -> "$8,420,000" (no cents — headline display). */
export function formatUsdCompactAmount(decimal: string | null | undefined): string | null {
  if (decimal == null) return null;
  const n = Number(decimal);
  if (!Number.isFinite(n)) return null;
  return `$${n.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/** ISO date -> "Jun 30, 2026" (deterministic, no locale drift). */
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

export function formatIsoDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** ISO date -> "Jun 30, 2026, 14:32 UTC" for event/signal rows. */
export function formatIsoDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** "2026-06" -> "Jun" (dense x-axis label, deterministic — no locale drift). */
export function formatPeriodMonth(period: string): string {
  const m = period.split("-")[1];
  const monthIdx = Number(m) - 1;
  return MONTHS[monthIdx] ?? period;
}

/** Maps a block's DataStatus to the closest <ProvenanceBadge> kind.
 *  UNIFIED honesty mapping: "FIXTURE" -> "simulated" (sandbox marker, never
 *  mistaken for Live — ProvenanceBadge doc). Never returns "live" for
 *  anything but a real LIVE status. */
export type BtcProvenanceKind =
  | "live"
  | "stale"
  | "simulated"
  | "estimated"
  | "partial";

export function toProvenance(status: string): BtcProvenanceKind {
  switch (status) {
    case "LIVE":
      return "live";
    case "STALE":
      return "stale";
    case "FIXTURE":
      return "simulated";
    case "PARTIAL":
      return "partial";
    default:
      return "estimated";
  }
}
