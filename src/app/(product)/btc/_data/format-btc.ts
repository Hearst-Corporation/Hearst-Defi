// src/app/(product)/btc/_data/format-btc.ts
//
// Pure display formatters for the /btc page. No business logic — string
// formatting only (mirrors the pattern of src/lib/format/usd-compact.ts).

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

/** Basis points -> "33.00%". */
export function formatBps(bps: number, precision = 1): string {
  return `${(bps / 100).toFixed(precision)}%`;
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

/** ISO date -> "Jun 30, 2026, 14:32 UTC" for event timeline rows. */
export function formatIsoDateTime(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}, ${hh}:${mm} UTC`;
}

/** "2026-06" -> "Jun '26" (bar chart x-axis label). */
export function formatPeriodShort(period: string): string {
  const [y, m] = period.split("-");
  const monthIdx = Number(m) - 1;
  const month = MONTHS[monthIdx] ?? period;
  return `${month} '${y?.slice(2) ?? ""}`;
}

/** "0x8f2a...c19e" passthrough helper — truncates a full hash defensively if a
 *  fixture ever supplies one, otherwise returns the input unchanged. */
export function truncateHash(hash: string): string {
  if (hash.length <= 12 || hash.includes("...")) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
}

/** Maps a block's DataStatus to the closest <ProvenanceBadge>/<Metric> kind.
 *  "FIXTURE" -> "simulated" (sandbox marker, never mistaken for Live —
 *  ProvenanceBadge doc). Never returns "live" for anything but a real LIVE
 *  status. */
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
