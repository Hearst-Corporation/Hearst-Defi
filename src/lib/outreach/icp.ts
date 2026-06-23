import "server-only";

import { tierForScore, type TierThresholds } from "@/lib/outreach/tier";

/**
 * ICP (Ideal Customer Profile) serde + the sourcing runner contract.
 *
 * The OutreachICP row stores Apollo filters as JSON strings (SQLite has no
 * array column). This module is the single place that parses/serialises those
 * fields and turns an ICP into Apollo search filters.
 *
 * SOURCING RUNNER — STATUS: REAL (with mock fallback when APOLLO_API_KEY absent).
 * `runSourcingForIcp` runs the full Apollo search → enrich → score pipeline when
 * APOLLO_API_KEY is present, or falls back to a deterministic mock set (no credit
 * spent, no network) when the key is absent. The mock is clearly flagged via
 * `isMock: true`. An optional `deps` param allows injecting stubs for testing.
 */

import type { ApolloPerson, ApolloSearchFilters } from "@/lib/apollo/client";
import type { ScoreProspectInput, OutreachScore } from "@/lib/agents/outreach-scorer";
import { logger } from "@/lib/logger";

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

/** Turn ICP filters into Apollo search parameters. */
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
// Sourcing runner types
// ---------------------------------------------------------------------------

export interface SourcedCandidate {
  email: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  title: string | null;
  apolloId: string | null;
  // Apollo enrichment snapshot — persisted on the prospect for the CRM sheet.
  linkedinUrl: string | null;
  companyDomain: string | null;
  industry: string | null;
  emailStatus: string | null;
  /** Raw enriched ApolloPerson JSON (everything Apollo returned), or null. */
  apolloData: string | null;
  /** 0-100 qualification score (mock: derived from the ICP fit deterministically). */
  qualScore: number;
  /** Tier resolved from qualScore against the ICP thresholds, or null = rejected. */
  tier: "A" | "B" | "C" | null;
}

/** Counters for a single pipeline run — useful for admin display and auditing. */
export interface SourcingStats {
  /** Number of people returned by Apollo search. */
  searched: number;
  /** Number of enrich calls attempted (skips dedup + id-empty). */
  enrichAttempted: number;
  /** Number of enrich calls that threw / failed. */
  enrichFailed: number;
  /** Candidates dropped because email was unverified or enrich returned null. */
  rejectedUnverified: number;
  /** Candidates dropped because their score was below tierCMin. */
  rejectedTier: number;
  /** Candidates skipped pre-enrich because their apolloId was already in DB. */
  dedupSkipped: number;
  /** Candidates that made it all the way to the result set. */
  kept: number;
}

export interface RunSourcingResult {
  candidates: SourcedCandidate[];
  /** True while the sourcer is the mock (no APOLLO_API_KEY and no deps injected). */
  isMock: boolean;
  /** Pipeline execution counters. */
  stats: SourcingStats;
}

// ---------------------------------------------------------------------------
// Dependency injection interface (for tests)
// ---------------------------------------------------------------------------

export interface SourcingDeps {
  search?: (
    filters: ApolloSearchFilters & { perPage?: number },
  ) => Promise<{ people: ApolloPerson[] }>;
  enrich?: (input: { apolloId: string; organizationDomain?: string }) => Promise<ApolloPerson | null>;
  score?: (input: ScoreProspectInput) => Promise<OutreachScore>;
  /**
   * P1-1: Pre-enrich dedup hook. Given a list of apolloIds from the search
   * results, returns the subset that are already known in the DB. Those ids
   * are skipped before any credit-consuming enrich call is made.
   */
  alreadyKnownApolloIds?: (ids: string[]) => Promise<Set<string>>;
}

// ---------------------------------------------------------------------------
// Mock fallback — deterministic, NO network, NO credit
// ---------------------------------------------------------------------------

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
    const company = `${firm} Partners ${i + 1}`;
    const industry = filters.industries[0] ?? "financial services";
    out.push({
      email: `partner@${domain}`,
      firstName: "Demo",
      lastName: `Lead ${i + 1}`,
      company,
      title: firm,
      apolloId: `mock_${slug}`,
      linkedinUrl: `https://www.linkedin.com/in/${slug}`,
      companyDomain: domain,
      industry,
      emailStatus: "verified",
      apolloData: JSON.stringify({
        id: `mock_${slug}`,
        name: `Demo Lead ${i + 1}`,
        title: firm,
        organizationName: company,
        organizationDomain: domain,
        organizationIndustry: industry,
        location: geoTag,
        mock: true,
      }),
      qualScore: seededScore(seed),
    });
  }
  return out;
}

/** Maximum candidates per sourcing run — Apollo rate-limit / cost guardrail. */
const MAX_SOURCING_COUNT = 50;

// ---------------------------------------------------------------------------
// Real Apollo pipeline
// ---------------------------------------------------------------------------

/**
 * Pure inline check — mirrors `isSendableEmail` from `@/lib/apollo/client`
 * exactly. Inlined here so the Apollo module import is skipped entirely when
 * both `search` and `enrich` deps are injected (avoids the `server-only`
 * transitive chain in test environments that provide all deps).
 */
function isVerifiedEmail(person: Pick<ApolloPerson, "email" | "emailStatus">): boolean {
  return Boolean(person.email) && person.emailStatus === "verified";
}

async function runApolloPipeline(
  icpName: string,
  filters: IcpFilters,
  thresholds: TierThresholds,
  count: number,
  deps: SourcingDeps,
): Promise<{ candidates: SourcedCandidate[]; stats: SourcingStats }> {
  // Only load the real Apollo module when a search/enrich dep is missing.
  // This avoids pulling its transitive dependencies in test environments that
  // supply all stubs.
  const apolloModule =
    deps.search == null || deps.enrich == null
      ? await import("@/lib/apollo/client")
      : null;

  // Only load the real scorer when the score dep is missing. The scorer
  // transitively imports `@/lib/llm/client` → `@/lib/db`, which requires a
  // Prisma adapter; skip the load entirely when a stub is provided.
  const scorerModule =
    deps.score == null
      ? await import("@/lib/agents/outreach-scorer")
      : null;

  const searchFn = deps.search ?? apolloModule!.searchPeople;
  const enrichFn = deps.enrich ?? apolloModule!.enrichPerson;
  const scoreFn = deps.score ?? scorerModule!.scoreProspect;

  const safeCount = Math.min(count, MAX_SOURCING_COUNT);

  const apolloFilters = icpToApolloFilters(filters);
  const searchResult = await searchFn({ ...apolloFilters, perPage: safeCount });

  const people = searchResult.people.slice(0, safeCount);

  // --- P1-1: Pre-enrich dedup on apolloId (before spending any credits) ---
  const candidateIds = people.map((p) => p.id).filter((id): id is string => Boolean(id));
  let knownIds = new Set<string>();
  if (deps.alreadyKnownApolloIds && candidateIds.length > 0) {
    knownIds = await deps.alreadyKnownApolloIds(candidateIds);
  }
  const dedupSkippedCount = people.filter((p) => p.id && knownIds.has(p.id)).length;
  if (dedupSkippedCount > 0) {
    logger.info("outreach/icp: pre-enrich dedup skipped candidates", {
      icpName,
      dedupSkipped: dedupSkippedCount,
    });
  }

  const stats: SourcingStats = {
    searched: people.length,
    enrichAttempted: 0,
    enrichFailed: 0,
    rejectedUnverified: 0,
    rejectedTier: 0,
    dedupSkipped: dedupSkippedCount,
    kept: 0,
  };

  const candidates: SourcedCandidate[] = [];

  for (const person of people) {
    // P2-1: Guard against persons with empty id — skip before any credit spend.
    if (!person.id) {
      logger.warn("outreach/icp: candidate without apolloId, skipping", { icpName });
      continue;
    }

    // P1-1: Skip persons already known in the DB (checked before enrich).
    if (knownIds.has(person.id)) {
      continue;
    }

    // Enrich (credit-consuming). Skip on individual error, log and continue.
    let enriched: ApolloPerson | null = null;
    stats.enrichAttempted += 1;
    try {
      enriched = await enrichFn({
        // P2-3: Use the search-result id (person.id) as the lookup key so that
        // the stored apolloId (from search) matches what the next run's dedup
        // hook queries against. If enrich returns a different id, we still
        // store person.id for dedup consistency.
        apolloId: person.id,
        organizationDomain: person.organizationDomain ?? undefined,
      });
    } catch (err) {
      stats.enrichFailed += 1;
      logger.warn("outreach/icp: enrichPerson failed — skipping candidate", {
        apolloId: person.id,
        icpName,
      }, err);
      continue;
    }

    // Must have a verified email to proceed.
    if (!enriched || !isVerifiedEmail(enriched)) {
      stats.rejectedUnverified += 1;
      continue;
    }

    const email = enriched.email as string; // isVerifiedEmail guarantees non-null

    // Score via the scorer agent (or injected stub).
    const scoreInput: ScoreProspectInput = {
      prospect: {
        firstName: enriched.firstName,
        lastName: enriched.lastName,
        title: enriched.title,
        company: enriched.organizationName,
        organizationIndustry: enriched.organizationIndustry,
        email,
      },
      icp: {
        persona: "distributor",
        titles: filters.titles,
        locations: filters.locations,
        industries: filters.industries,
      },
    };

    const { score } = await scoreFn(scoreInput);
    const tier = tierForScore(score, thresholds);
    if (tier === null) {
      stats.rejectedTier += 1;
      continue; // below tierCMin — rejected
    }

    stats.kept += 1;
    candidates.push({
      email,
      firstName: enriched.firstName,
      lastName: enriched.lastName,
      company: enriched.organizationName,
      title: enriched.title,
      // P2-3: Store the search-result apolloId (person.id) so the next run's
      // pre-enrich dedup hook matches against it correctly.
      apolloId: person.id,
      // Apollo enrichment snapshot — surfaced on the prospect CRM sheet.
      linkedinUrl: enriched.linkedinUrl,
      companyDomain: enriched.organizationDomain,
      industry: enriched.organizationIndustry,
      emailStatus: enriched.emailStatus,
      apolloData: JSON.stringify(enriched),
      qualScore: score,
      tier,
    });
  }

  // P2-5: If every enrich attempt failed, something is systemically wrong
  // (bad key, quota exhausted). A 100% failure rate is not a legitimate
  // "zero results" — surface it as an error so operators know immediately.
  if (stats.enrichAttempted > 0 && stats.enrichFailed === stats.enrichAttempted) {
    throw new Error(
      "outreach sourcing: every Apollo enrichment failed — check APOLLO_API_KEY / quota",
    );
  }

  return { candidates, stats };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Source candidates for an ICP and assign each a tier from its score.
 *
 * - When `APOLLO_API_KEY` is absent and no `deps` are injected → mock fallback
 *   (`isMock: true`), deterministic, zero network.
 * - When `APOLLO_API_KEY` is present OR `deps` are injected → real Apollo
 *   pipeline: search → enrich → filter verified → score → tier (`isMock: false`).
 *
 * The optional `deps` parameter lets tests inject stubs so the real pipeline
 * runs without any network calls.
 */
export async function runSourcingForIcp(
  icpName: string,
  filters: IcpFilters,
  thresholds: TierThresholds,
  count: number,
  deps?: SourcingDeps,
): Promise<RunSourcingResult> {
  const hasKey = Boolean(process.env.APOLLO_API_KEY);
  const hasDeps = Boolean(deps && (deps.search ?? deps.enrich ?? deps.score));

  // Use real pipeline when the key is present OR when deps are injected for testing.
  if (hasKey || hasDeps) {
    const { candidates, stats } = await runApolloPipeline(
      icpName,
      filters,
      thresholds,
      count,
      deps ?? {},
    );
    return { candidates, isMock: false, stats };
  }

  // Fallback: mock (no key, no deps).
  const raw = generateCandidates(icpName, filters, count);
  const candidates: SourcedCandidate[] = [];
  for (const c of raw) {
    const tier = tierForScore(c.qualScore, thresholds);
    if (tier === null) continue;
    candidates.push({ ...c, tier });
  }

  const mockStats: SourcingStats = {
    searched: raw.length,
    enrichAttempted: 0,
    enrichFailed: 0,
    rejectedUnverified: 0,
    rejectedTier: raw.length - candidates.length,
    dedupSkipped: 0,
    kept: candidates.length,
  };

  return { candidates, isMock: true, stats: mockStats };
}
