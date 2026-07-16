// Dashboard-local formatting helpers. ViewModel money fields are decimal
// strings (`"250000.000000"` or null) — never numbers — so every read goes
// through `parseUsdcString` first. Never renders a fabricated value: a null
// input returns `null`, and callers must fall back to a state component
// (DataUnavailable/EmptySurface), never to "0".

import { formatUsdFull } from "@/lib/vaults/product-display";

/** Parse a decimal-string USDC amount into a number, or null if absent/invalid. */
export function parseUsdcString(raw: string | null | undefined): number | null {
  if (raw == null || raw.trim().length === 0) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Format a decimal-string USDC amount as full USD ("$250,000"), or null passthrough. */
export function formatUsdcAmount(raw: string | null | undefined): string | null {
  const n = parseUsdcString(raw);
  return n === null ? null : formatUsdFull(n);
}

/** Format basis points (0-10000) as a percentage string, e.g. 4020 -> "40.2%". */
export function formatBps(bps: number | null | undefined): string | null {
  if (bps == null) return null;
  return `${(bps / 100).toFixed(1)}%`;
}

/** Format an ISO timestamp as a short human date, e.g. "Jul 16, 2026". */
export function formatIsoDate(iso: string | null | undefined): string | null {
  if (iso == null) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(d);
}

/** Format satoshis as BTC, e.g. "18,420,500" sats -> "0.18420500 BTC". */
export function formatSatsAsBtc(sats: string | null | undefined): string | null {
  if (sats == null) return null;
  const n = Number(sats);
  if (!Number.isFinite(n)) return null;
  return `${(n / 1e8).toFixed(8)} BTC`;
}
