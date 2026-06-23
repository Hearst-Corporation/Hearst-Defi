import type { HeroKpi } from "@/lib/data/cockpit";
import { formatRelativeTimeDate } from "./time-formatters";

interface AuditEntry {
  occurredAt: Date;
  actorWallet: string;
}

/**
 * Derives honest KPIs from the audit entries already loaded by /admin/audit.
 * No DB queries — pure derivation from the in-memory slice.
 *
 * Returns [] when entries is empty (caller suppresses the strip).
 *
 * KPIs:
 *   - Total events     : count of entries in current view      (provenance: manual)
 *   - Distinct actors  : unique actorWallet values             (provenance: manual)
 *   - Most recent      : relative age of newest event          (provenance: manual)
 *   - Today            : events whose occurredAt falls on UTC today (provenance: manual)
 *
 * @param entries  Already-fetched audit entries (newest-first order expected but not required).
 * @param now      Injection point for the current timestamp (testability + engine purity).
 */
export function buildAuditKpiStrip(
  entries: AuditEntry[],
  now: Date = new Date(),
): HeroKpi[] {
  if (entries.length === 0) return [];

  // — Total events —
  const total = entries.length;

  // — Distinct actors —
  const actors = new Set(entries.map((e) => e.actorWallet.toLowerCase()));
  const distinctActors = actors.size;

  // — Most recent event —
  // entries are newest-first, but sort defensively.
  const newestAt = entries.reduce<Date>((best, e) =>
    e.occurredAt > best ? e.occurredAt : best, entries[0]!.occurredAt,
  );
  const mostRecentLabel = formatRelativeTimeDate(newestAt, now);

  // — Today's events (UTC day boundary) —
  const todayStr = now.toISOString().slice(0, 10); // "YYYY-MM-DD"
  const todayCount = entries.filter(
    (e) => e.occurredAt.toISOString().slice(0, 10) === todayStr,
  ).length;

  const kpis: HeroKpi[] = [
    {
      label: "Events",
      value: String(total),
      sublabel: total === 200 ? "capped at 200 per query" : "in current view",
      provenance: "manual",
    },
    {
      label: "Distinct actors",
      value: String(distinctActors),
      sublabel: "unique wallets",
      provenance: "manual",
    },
    {
      label: "Most recent",
      value: mostRecentLabel,
      sublabel: newestAt.toISOString().slice(0, 10),
      provenance: "manual",
      accent: true,
    },
    {
      label: "Today",
      value: String(todayCount),
      sublabel: `UTC ${todayStr}`,
      provenance: "manual",
    },
  ];

  return kpis;
}
