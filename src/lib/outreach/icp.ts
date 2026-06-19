import "server-only";

import { tierForScore, type TierThresholds } from "@/lib/outreach/tier";

/**
 * ICP (Ideal Customer Profile) serde + the sourcing runner contract.
 *
 * The OutreachICP row stores Apollo filters as JSON strings (SQLite has no
 * array column). This module is the single place that parses/serialises those
 * fields and turns an ICP into Apollo search filters.
 *
 * SOURCING RUNNER — STATUS: MOCK.
 * `runSourcingForIcp` is the seam the Palier-1 Apollo pipeline plugs into. Today
 * it returns a deterministic mock set so the page is fully clickable WITHOUT
 * spending an Apollo credit. The real implementation (search → enrich → score)
 * replaces ONLY the body of `generateCandidates`; the action/DB-write side that
 * consumes it stays the same. The mock is clearly flagged in the UI ("demo
 * leads") and never sends an email.
 */

import type { ApolloSearchFilters } from "@/lib/apollo/client";

// ---------------------------------------------------------------------------
// Serde
// ---------------------------------------------------------------------------

export interface IcpFilters {
  titles: string[];
  seniorities: string[];
  locations: string[];
  industries: string[];
  headcount: string[];
  keywords: string[];
}

/** Parse a JSON string array field; tolerate null / malformed → []. */
function parseList(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((v): v is string => typeof v === "string" && v.length > 0);
  } catch {
    return [];
  }
}

/** Serialise a string[] for storage; empty → null (keeps the column tidy). */
export function serializeList(values: string[] | undefined): string | null {
  const clean = (values ?? []).map((v) => v.trim()).filter((v) => v.length > 0);
  return clean.length > 0 ? JSON.stringify(clean) : null;
}

/** A DB OutreachICP row shape (only the fields this module reads). */
export interface IcpRowLike {
  titles: string | null;
  seniorities: string | null;
  locations: string | null;
  industries: string | null;
  headcount: string | null;
  keywords: string | null;
}

/** Parse all list fields of a stored ICP into arrays. */
export function parseIcpFilters(row: IcpRowLike): IcpFilters {
  return {
    titles: parseList(row.titles),
    seniorities: parseList(row.seniorities),
    locations: parseList(row.locations),
    industries: parseList(row.industries),
    headcount: parseList(row.headcount),
    keywords: parseList(row.keywords),
  };
}

/** Turn ICP filters into Apollo search parameters (Palier 1 will use these). */
export function icpToApolloFilters(filters: IcpFilters): ApolloSearchFilters {
  return {
    personTitles: filters.titles,
    personSeniorities: filters.seniorities,
    personLocations: filters.locations,
    organizationIndustries: [...filters.industries, ...filters.keywords],
    organizationHeadcount: filters.headcount,
  };
}

// ---------------------------------------------------------------------------
// Sourcing runner — MOCK (Palier 1 replaces generateCandidates with Apollo)
// ---------------------------------------------------------------------------

export interface SourcedCandidate {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  apolloId: string | null;
  /** 0-100 qualification score (mock: derived from the ICP fit deterministically). */
  qualScore: number;
  /** Tier resolved from qualScore against the ICP thresholds, or null = rejected. */
  tier: "A" | "B" | "C" | null;
}

/** Deterministic pseudo-score from a string seed — stable across runs (no RNG). */
function seededScore(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  // Spread across 35-98 so the mock yields a realistic A/B/C/reject mix.
  return 35 + (h % 64);
}

/**
 * MOCK candidate generator. Produces `count` plausible distributor leads keyed
 * off the ICP so the same ICP yields the same demo set. NO network, NO credit.
 * Palier 1 swaps this body for: searchPeople → enrichPerson → scorer agent.
 */
function generateCandidates(
  icpName: string,
  filters: IcpFilters,
  count: number,
): Omit<SourcedCandidate, "tier">[] {
  const firmTypes = filters.titles.length > 0 ? filters.titles : ["Wealth Advisor"];
  const geoTag = filters.locations[0] ?? "Global";
  const out: Omit<SourcedCandidate, "tier">[] = [];
  for (let i = 0; i < count; i += 1) {
    const firm = firmTypes[i % firmTypes.length] ?? "Wealth Advisor";
    const slug = `${firm.replace(/\s+/g, "").toLowerCase()}${i + 1}`;
    const domain = `${slug}.example`;
    const seed = `${icpName}:${slug}:${geoTag}`;
    out.push({
      email: `partner@${domain}`,
      firstName: "Demo",
      lastName: `Lead ${i + 1}`,
      company: `${firm} Partners ${i + 1}`,
      title: firm,
      apolloId: `mock_${slug}`,
      qualScore: seededScore(seed),
    });
  }
  return out;
}

export interface RunSourcingResult {
  candidates: SourcedCandidate[];
  /** True while the sourcer is the mock (Palier 0). UI shows a "demo" notice. */
  isMock: boolean;
}

/**
 * Source candidates for an ICP and assign each a tier from its score. Currently
 * MOCK (see module header). Rejected candidates (score below tierCMin) are
 * dropped here so the caller only persists tiered leads.
 */
export async function runSourcingForIcp(
  icpName: string,
  filters: IcpFilters,
  thresholds: TierThresholds,
  count: number,
): Promise<RunSourcingResult> {
  const raw = generateCandidates(icpName, filters, count);
  const candidates: SourcedCandidate[] = [];
  for (const c of raw) {
    const tier = tierForScore(c.qualScore, thresholds);
    if (tier === null) continue; // rejected — below tierCMin
    candidates.push({ ...c, tier });
  }
  return { candidates, isMock: true };
}
