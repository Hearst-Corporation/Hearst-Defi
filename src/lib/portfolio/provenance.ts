import type { Provenance } from "@/components/ui/provenance-badge";

/** Portfolio snapshot SLO — mirrors STALE_THRESHOLDS.portfolio_snapshot. */
const PORTFOLIO_SNAPSHOT_MS = 24 * 60 * 60 * 1000;

/**
 * Normalise dates from Prisma, RSC props, or `unstable_cache` (JSON → ISO string).
 */
export function coercePortfolioDate(
  value: Date | string | null | undefined,
): Date | null {
  if (value == null) return null;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value : null;
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed : null;
  }
  return null;
}

function isFresh(asOf: Date): boolean {
  const ageMs = Date.now() - asOf.getTime();
  return Number.isFinite(ageMs) && ageMs >= 0 && ageMs <= PORTFOLIO_SNAPSHOT_MS;
}

/**
 * Maps portfolio data source + freshness to a canonical Provenance kind for UI.
 * Pure helper — safe to import from client components (no DB / server-only).
 */
export function resolveProvenance(
  source: "live" | "fallback" | "stale" | "estimated" | "oracle" | "attested",
  updatedAt?: Date | string | null,
  preferred: Provenance = "live",
): Provenance {
  if (source === "fallback" || source === "stale") return "stale";
  const asOf = coercePortfolioDate(updatedAt);
  if (!asOf) return "stale";
  if (!isFresh(asOf)) return "stale";

  if (source === "oracle") return "oracle";
  if (source === "attested") return "attested";
  if (source === "estimated") return "estimated";

  if (preferred === "oracle" || preferred === "attested") {
    return source === "live" ? preferred : "stale";
  }

  return preferred;
}
