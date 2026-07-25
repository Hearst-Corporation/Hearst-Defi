import "server-only";

/**
 * Apollo.io REST client — fetch-only, no SDK dependency.
 *
 * Apollo is the lead-discovery + enrichment source for the Outreach engine
 * (B2B distributor prospecting). Two capabilities are wrapped here:
 *
 *   1. `searchPeople`  — POST /v1/mixed_people/api_search
 *      Query the ~275M-contact database by persona filters (titles, seniorities,
 *      industries, locations, employee headcount). Returns lightweight people
 *      records WITHOUT a revealed email — discovery is cheap, email reveal costs
 *      a credit, so the two stages are deliberately split (sourcer vs enricher).
 *
 *   2. `enrichPerson` — POST /v1/people/match
 *      Reveal/verify the work email + firmographics for one person (by Apollo id
 *      or name+domain). This is the credit-consuming call. The caller decides
 *      whether to spend a credit based on the person's tier (Tier A/B/C).
 *
 * Auth: `APOLLO_API_KEY` (header `X-Api-Key`). Sourced from `process.env` only —
 * never hard-coded (the key lives in ~/.claude/api-config/SERVICES.md).
 *
 * Fail-closed: every function throws when the API key is absent. Callers in the
 * Outreach pipeline are responsible for catching where a soft failure is wanted
 * (mirrors the HubSpot client contract in `src/lib/hubspot/client.ts`).
 *
 * Testability: an `ApolloFetch` can be injected (default = global `fetch`) so
 * unit tests never hit the network. No `any`; the slice of the Apollo response
 * we read is typed and narrowed defensively (the API returns far more fields).
 */

import { readServerEnv } from "@/lib/env";

const BASE = "https://api.apollo.io";

/** Injectable fetch — tests pass a stub matching this shape. */
export type ApolloFetch = typeof fetch;

function apiKey(): string {
  // LIVE read via the canon helper: unit tests set/delete the key per test.
  const key = readServerEnv("APOLLO_API_KEY");
  if (!key) throw new Error("APOLLO_API_KEY is not set");
  return key;
}

/**
 * Low-level Apollo POST. Apollo authenticates via the `X-Api-Key` header (the
 * legacy `api_key` body field is deprecated). Throws on non-2xx with the status
 * and a truncated body for diagnosis.
 */
async function apollo<T>(
  path: string,
  body: unknown,
  fetchImpl: ApolloFetch,
): Promise<T> {
  const res = await fetchImpl(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      "X-Api-Key": apiKey(),
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`Apollo POST ${path} → ${res.status}: ${text.slice(0, 300)}`);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : ({} as T);
}

// ---------------------------------------------------------------------------
// People search (discovery — no email reveal)
// ---------------------------------------------------------------------------

/**
 * Persona filters for a search. All optional; an empty query is rejected by the
 * caller (the sourcer always supplies at least titles). Field names map to
 * Apollo's `mixed_people/search` parameters.
 */
export interface ApolloSearchFilters {
  /** Job titles, e.g. ["wealth manager", "family office", "RIA"]. */
  personTitles?: string[];
  /** Seniorities, e.g. ["owner", "founder", "c_suite", "partner", "director"]. */
  personSeniorities?: string[];
  /** Person locations, e.g. ["United States", "Switzerland", "United Kingdom"]. */
  personLocations?: string[];
  /** Org industry tags / keywords, e.g. ["financial services", "wealth management"]. */
  organizationIndustries?: string[];
  /** Org headcount bands, e.g. ["11,50", "51,200"] (Apollo's range syntax). */
  organizationHeadcount?: string[];
  /** 1-based page. */
  page?: number;
  /** Page size (Apollo caps at 100). */
  perPage?: number;
}

/** A person as returned by search — email is typically masked/absent here. */
export interface ApolloPerson {
  id: string;
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  title: string | null;
  /** Present only when already revealed; search usually returns null/masked. */
  email: string | null;
  linkedinUrl: string | null;
  organizationName: string | null;
  organizationDomain: string | null;
  organizationIndustry: string | null;
  /** Apollo's email deliverability status when present, e.g. "verified". */
  emailStatus: string | null;
}

export interface ApolloSearchResult {
  people: ApolloPerson[];
  /** Total matches Apollo reports for the query (for paging). */
  totalEntries: number;
  page: number;
  perPage: number;
}

/** Raw person shape from Apollo — only the fields we read, all optional. */
interface RawApolloPerson {
  id?: unknown;
  first_name?: unknown;
  last_name?: unknown;
  name?: unknown;
  title?: unknown;
  email?: unknown;
  email_status?: unknown;
  linkedin_url?: unknown;
  organization?: {
    name?: unknown;
    primary_domain?: unknown;
    website_url?: unknown;
    industry?: unknown;
  } | null;
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function normalizePerson(raw: RawApolloPerson): ApolloPerson | null {
  const id = str(raw.id);
  if (!id) return null; // a record with no id is unusable downstream
  const org = raw.organization ?? null;
  return {
    id,
    firstName: str(raw.first_name),
    lastName: str(raw.last_name),
    name: str(raw.name),
    title: str(raw.title),
    email: str(raw.email),
    emailStatus: str(raw.email_status),
    linkedinUrl: str(raw.linkedin_url),
    organizationName: org ? str(org.name) : null,
    organizationDomain: org
      ? str(org.primary_domain) ?? str(org.website_url)
      : null,
    organizationIndustry: org ? str(org.industry) : null,
  };
}

/**
 * Search Apollo's people database by persona filters. Returns lightweight
 * records (no credit spent — emails are revealed separately via `enrichPerson`).
 */
export async function searchPeople(
  filters: ApolloSearchFilters,
  fetchImpl: ApolloFetch = fetch,
): Promise<ApolloSearchResult> {
  const perPage = Math.min(Math.max(filters.perPage ?? 25, 1), 100);
  const page = Math.max(filters.page ?? 1, 1);

  const body: Record<string, unknown> = { page, per_page: perPage };
  if (filters.personTitles?.length) body.person_titles = filters.personTitles;
  if (filters.personSeniorities?.length)
    body.person_seniorities = filters.personSeniorities;
  if (filters.personLocations?.length)
    body.person_locations = filters.personLocations;
  if (filters.organizationIndustries?.length)
    body.q_organization_keyword_tags = filters.organizationIndustries;
  if (filters.organizationHeadcount?.length)
    body.organization_num_employees_ranges = filters.organizationHeadcount;

  // Apollo deprecated `/v1/mixed_people/search` for API callers (returns 422
  // with a redirect message). The current people-search endpoint is
  // `/v1/mixed_people/api_search` — same body shape; it returns a lighter
  // person record (no last_name / email_status / domain at this stage), which
  // is by design: enrichPerson() reveals the full record + verified email.
  const data = await apollo<{
    people?: RawApolloPerson[];
    pagination?: { total_entries?: unknown; page?: unknown; per_page?: unknown };
  }>("/v1/mixed_people/api_search", body, fetchImpl);

  const people = (data.people ?? [])
    .map(normalizePerson)
    .filter((p): p is ApolloPerson => p !== null);

  const totalEntries =
    typeof data.pagination?.total_entries === "number"
      ? data.pagination.total_entries
      : people.length;

  return { people, totalEntries, page, perPage };
}

// ---------------------------------------------------------------------------
// Person enrichment (email reveal — consumes a credit)
// ---------------------------------------------------------------------------

export interface ApolloEnrichInput {
  /** Apollo person id from a prior search (preferred). */
  apolloId?: string;
  /** Fallback match keys when no id is available. */
  firstName?: string;
  lastName?: string;
  /** Organization domain (e.g. "acme.com") — strongly improves match rate. */
  organizationDomain?: string;
}

/**
 * Reveal/verify a single person's work email + firmographics. CREDIT-CONSUMING.
 *
 * `reveal_personal_emails: false` keeps us to professional emails only (B2B
 * outreach; avoids personal inboxes for compliance). Returns null when Apollo
 * has no match or no email to reveal.
 */
export async function enrichPerson(
  input: ApolloEnrichInput,
  fetchImpl: ApolloFetch = fetch,
): Promise<ApolloPerson | null> {
  const body: Record<string, unknown> = {
    reveal_personal_emails: false,
  };
  if (input.apolloId) body.id = input.apolloId;
  if (input.firstName) body.first_name = input.firstName;
  if (input.lastName) body.last_name = input.lastName;
  if (input.organizationDomain) body.domain = input.organizationDomain;

  const data = await apollo<{ person?: RawApolloPerson | null }>(
    "/v1/people/match",
    body,
    fetchImpl,
  );

  if (!data.person) return null;
  return normalizePerson(data.person);
}

/** Whether an Apollo email is safe to send to (verified deliverability). */
export function isSendableEmail(person: Pick<ApolloPerson, "email" | "emailStatus">): boolean {
  if (!person.email) return false;
  // Apollo marks reliable addresses "verified"; everything else (guessed,
  // unavailable, "unverified") is rejected to protect deliverability.
  return person.emailStatus === "verified";
}
