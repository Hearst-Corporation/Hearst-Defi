/**
 * Tests for src/lib/outreach/icp.ts
 *
 * All tests run with ZERO real network calls. The Apollo + scorer deps are
 * either injected via the `deps` param or avoided entirely (mock fallback path).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_TIER_THRESHOLDS } from "@/lib/outreach/tier";
import {
  icpToApolloFilters,
  parseIcpFilters,
  runSourcingForIcp,
  serializeList,
  type IcpFilters,
  type SourcingDeps,
} from "@/lib/outreach/icp";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_FILTERS: IcpFilters = {
  titles: ["Wealth Advisor", "Portfolio Manager"],
  seniorities: ["partner", "director"],
  locations: ["United States", "Switzerland"],
  industries: ["financial services", "wealth management"],
  headcount: ["11,50"],
  keywords: ["RIA", "family office"],
};

/** Factory for a minimal ApolloPerson (verified email by default). */
function makePerson(id: string, overrides: Partial<{
  email: string | null;
  emailStatus: string | null;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  organizationName: string | null;
  organizationDomain: string | null;
  organizationIndustry: string | null;
}> = {}) {
  // Use explicit `in` check rather than `??` so callers can explicitly pass
  // `null` for email/emailStatus (null ?? default = default, which is wrong).
  return {
    id,
    firstName: "firstName" in overrides ? overrides.firstName ?? null : "Alice",
    lastName: "lastName" in overrides ? overrides.lastName ?? null : "Smith",
    name: null,
    title: "title" in overrides ? overrides.title ?? null : "Wealth Advisor",
    email: "email" in overrides ? overrides.email : `alice${id}@verified.com`,
    emailStatus: "emailStatus" in overrides ? overrides.emailStatus : "verified",
    linkedinUrl: null,
    organizationName:
      "organizationName" in overrides ? overrides.organizationName ?? null : "Prime Wealth",
    organizationDomain:
      "organizationDomain" in overrides
        ? overrides.organizationDomain ?? null
        : "primewealth.com",
    organizationIndustry:
      "organizationIndustry" in overrides
        ? overrides.organizationIndustry ?? null
        : "financial services",
  };
}

// ---------------------------------------------------------------------------
// serializeList / parseIcpFilters
// ---------------------------------------------------------------------------

describe("serializeList", () => {
  it("serialises a non-empty array to JSON", () => {
    expect(serializeList(["a", "b"])).toBe('["a","b"]');
  });

  it("returns null for empty array", () => {
    expect(serializeList([])).toBeNull();
  });

  it("returns null for undefined", () => {
    expect(serializeList(undefined)).toBeNull();
  });

  it("trims and filters blank strings", () => {
    expect(serializeList(["  ", "ok", ""])).toBe('["ok"]');
  });
});

describe("parseIcpFilters", () => {
  it("parses all fields correctly", () => {
    const row = {
      titles: '["RIA","HNW"]',
      seniorities: '["partner"]',
      locations: '["US"]',
      industries: '["finance"]',
      headcount: '["11,50"]',
      keywords: '["family office"]',
    };
    const result = parseIcpFilters(row);
    expect(result.titles).toEqual(["RIA", "HNW"]);
    expect(result.keywords).toEqual(["family office"]);
  });

  it("tolerates null fields → empty arrays", () => {
    const row = {
      titles: null,
      seniorities: null,
      locations: null,
      industries: null,
      headcount: null,
      keywords: null,
    };
    const result = parseIcpFilters(row);
    expect(result.titles).toEqual([]);
    expect(result.industries).toEqual([]);
  });

  it("tolerates malformed JSON → empty array", () => {
    const row = {
      titles: "not-json",
      seniorities: null,
      locations: null,
      industries: null,
      headcount: null,
      keywords: null,
    };
    expect(parseIcpFilters(row).titles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// icpToApolloFilters
// ---------------------------------------------------------------------------

describe("icpToApolloFilters", () => {
  it("merges industries and keywords into organizationIndustries", () => {
    const result = icpToApolloFilters(BASE_FILTERS);
    expect(result.personTitles).toEqual(BASE_FILTERS.titles);
    expect(result.personSeniorities).toEqual(BASE_FILTERS.seniorities);
    expect(result.personLocations).toEqual(BASE_FILTERS.locations);
    expect(result.organizationIndustries).toEqual([
      ...BASE_FILTERS.industries,
      ...BASE_FILTERS.keywords,
    ]);
    expect(result.organizationHeadcount).toEqual(BASE_FILTERS.headcount);
  });

  it("passes empty arrays through", () => {
    const empty: IcpFilters = {
      titles: [],
      seniorities: [],
      locations: [],
      industries: [],
      headcount: [],
      keywords: [],
    };
    const result = icpToApolloFilters(empty);
    expect(result.organizationIndustries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// runSourcingForIcp — mock fallback path
// ---------------------------------------------------------------------------

describe("runSourcingForIcp — mock fallback (no key, no deps)", () => {
  beforeEach(() => {
    delete process.env.APOLLO_API_KEY;
  });

  afterEach(() => {
    delete process.env.APOLLO_API_KEY;
  });

  it("returns isMock:true when APOLLO_API_KEY is absent", async () => {
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      5,
    );
    expect(result.isMock).toBe(true);
  });

  it("generates up to `count` tiered candidates", async () => {
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
    );
    // Some candidates may be rejected (score below tierCMin=40) but we always
    // get at least one in the realistic range.
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.candidates.length).toBeLessThanOrEqual(10);
  });

  it("every candidate has a valid tier (A/B/C)", async () => {
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      15,
    );
    for (const c of result.candidates) {
      expect(["A", "B", "C"]).toContain(c.tier);
      expect(c.qualScore).toBeGreaterThanOrEqual(0);
      expect(c.qualScore).toBeLessThanOrEqual(100);
    }
  });

  it("is deterministic — same input yields same output", async () => {
    const a = await runSourcingForIcp("ria-ch", BASE_FILTERS, DEFAULT_TIER_THRESHOLDS, 8);
    const b = await runSourcingForIcp("ria-ch", BASE_FILTERS, DEFAULT_TIER_THRESHOLDS, 8);
    expect(a.candidates).toEqual(b.candidates);
  });

  it("drops candidates below tierCMin", async () => {
    // Set an absurdly high tierCMin so everything is rejected.
    const allRejectThresholds = { tierAMin: 999, tierBMin: 998, tierCMin: 998 };
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      allRejectThresholds,
      10,
    );
    expect(result.candidates).toHaveLength(0);
  });

  it("mock stats are coherent (searched=count, enrichAttempted=0, kept=candidates)", async () => {
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      8,
    );
    expect(result.stats.enrichAttempted).toBe(0);
    expect(result.stats.enrichFailed).toBe(0);
    expect(result.stats.dedupSkipped).toBe(0);
    expect(result.stats.kept).toBe(result.candidates.length);
    // searched = raw generated count (all 8, before tier filtering)
    expect(result.stats.searched).toBe(8);
    expect(result.stats.rejectedTier).toBe(8 - result.candidates.length);
  });
});

// ---------------------------------------------------------------------------
// runSourcingForIcp — real pipeline via injected deps
// ---------------------------------------------------------------------------

describe("runSourcingForIcp — real pipeline via injected deps", () => {
  beforeEach(() => {
    delete process.env.APOLLO_API_KEY;
  });

  afterEach(() => {
    delete process.env.APOLLO_API_KEY;
    vi.restoreAllMocks();
  });

  it("returns isMock:false when deps are provided", async () => {
    const p1 = makePerson("id1");

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1] }),
      enrich: vi.fn().mockResolvedValue(p1),
      score: vi.fn().mockResolvedValue({ score: 90, reasons: ["great fit"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      5,
      deps,
    );
    expect(result.isMock).toBe(false);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.apolloId).toBe("id1");
    expect(result.candidates[0]!.tier).toBe("A"); // score 90 >= tierAMin 85
    expect(result.candidates[0]!.qualScore).toBe(90);
  });

  it("drops non-verified email candidates", async () => {
    const verified = makePerson("v1", { emailStatus: "verified" });
    const unverified = makePerson("u1", { emailStatus: "unverified" });
    const noEmail = makePerson("n1", { email: null, emailStatus: null });

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [verified, unverified, noEmail] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) => {
        if (apolloId === "v1") return Promise.resolve(verified);
        if (apolloId === "u1") return Promise.resolve(unverified);
        return Promise.resolve(noEmail);
      }),
      score: vi.fn().mockResolvedValue({ score: 75, reasons: ["good fit"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );
    // Only verified passes isSendableEmail
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.apolloId).toBe("v1");
  });

  it("skips candidate when enrich throws (does not abort batch)", async () => {
    const p1 = makePerson("good1");
    const p2 = makePerson("bad1");
    const p3 = makePerson("good2");

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1, p2, p3] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) => {
        if (apolloId === "bad1") return Promise.reject(new Error("network timeout"));
        return Promise.resolve(makePerson(apolloId));
      }),
      score: vi.fn().mockResolvedValue({ score: 80, reasons: ["good"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );
    // bad1 skipped, good1 + good2 survive.
    expect(result.candidates).toHaveLength(2);
    const ids = result.candidates.map((c) => c.apolloId);
    expect(ids).not.toContain("bad1");
  });

  it("rejects candidates whose score is below tierCMin", async () => {
    const p1 = makePerson("low1");

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1] }),
      enrich: vi.fn().mockResolvedValue(p1),
      // Score = 10, below default tierCMin of 40 → rejected.
      score: vi.fn().mockResolvedValue({ score: 10, reasons: ["poor fit"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      5,
      deps,
    );
    expect(result.candidates).toHaveLength(0);
  });

  it("assigns correct tier based on score thresholds", async () => {
    const pa = makePerson("pa");
    const pb = makePerson("pb");
    const pc = makePerson("pc");

    const scores: Record<string, number> = { pa: 90, pb: 70, pc: 45 };

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [pa, pb, pc] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) =>
        Promise.resolve(makePerson(apolloId)),
      ),
      score: vi.fn().mockImplementation((input: { prospect: { email: string } }) => {
        // Extract apolloId from email (e.g. "alice_pa_@verified.com")
        // We set email to `alice${id}@verified.com` in makePerson.
        const email = input.prospect.email;
        const match = email.match(/alice(\w+)@verified/);
        const id = match?.[1] ?? "pa";
        return Promise.resolve({ score: scores[id] ?? 50, reasons: ["scored"] });
      }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );

    expect(result.candidates).toHaveLength(3);
    const byId = Object.fromEntries(result.candidates.map((c) => [c.apolloId, c]));
    expect(byId["pa"]!.tier).toBe("A"); // 90 >= 85
    expect(byId["pb"]!.tier).toBe("B"); // 70 >= 60, < 85
    expect(byId["pc"]!.tier).toBe("C"); // 45 >= 40, < 60
  });

  it("clamps count to 50 max", async () => {
    const people = Array.from({ length: 60 }, (_, i) => makePerson(`p${i}`));

    const searchFn = vi.fn().mockResolvedValue({ people });
    const deps: SourcingDeps = {
      search: searchFn,
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) =>
        Promise.resolve(makePerson(apolloId)),
      ),
      score: vi.fn().mockResolvedValue({ score: 90, reasons: ["fit"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      200, // caller passes 200 but pipeline clamps to 50
      deps,
    );
    // At most 50 candidates processed (60 people returned but sliced to 50)
    expect(result.candidates.length).toBeLessThanOrEqual(50);

    // search was called with perPage=50 (count clamped)
    const callArg = (searchFn.mock.calls[0] as [{ perPage?: number }])[0];
    expect(callArg.perPage).toBe(50);
  });

  it("returns isMock:false even when APOLLO_API_KEY is set and using real path", async () => {
    process.env.APOLLO_API_KEY = "test-key-for-flag-check";

    const p1 = makePerson("id1");
    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1] }),
      enrich: vi.fn().mockResolvedValue(p1),
      score: vi.fn().mockResolvedValue({ score: 65, reasons: ["ok"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      5,
      deps,
    );
    expect(result.isMock).toBe(false);
  });

  // -------------------------------------------------------------------------
  // P1-1: Pre-enrich dedup via alreadyKnownApolloIds
  // -------------------------------------------------------------------------

  it("P1-1: skips enrich for apolloIds already in DB; stats.dedupSkipped=1", async () => {
    const p1 = makePerson("known1");
    const p2 = makePerson("fresh2");
    const p3 = makePerson("fresh3");

    let enrichCallCount = 0;
    const enrichedIds: string[] = [];

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1, p2, p3] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) => {
        enrichCallCount += 1;
        enrichedIds.push(apolloId);
        return Promise.resolve(makePerson(apolloId));
      }),
      score: vi.fn().mockResolvedValue({ score: 80, reasons: ["good"] }),
      // P1-1 hook: known1 is already in DB
      alreadyKnownApolloIds: vi.fn().mockResolvedValue(new Set(["known1"])),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );

    // known1 must NOT have been enriched
    expect(enrichCallCount).toBe(2);
    expect(enrichedIds).not.toContain("known1");

    // known1 must not be in the result
    const ids = result.candidates.map((c) => c.apolloId);
    expect(ids).not.toContain("known1");
    expect(ids).toContain("fresh2");
    expect(ids).toContain("fresh3");

    // dedupSkipped counter
    expect(result.stats.dedupSkipped).toBe(1);
  });

  // -------------------------------------------------------------------------
  // P2-1: Guard on empty apolloId
  // -------------------------------------------------------------------------

  it("P2-1: person with empty id is skipped without calling enrich", async () => {
    // makePerson with id="" — id field will be ""
    const emptyIdPerson = { ...makePerson("good1"), id: "" };
    const validPerson = makePerson("good2");

    let enrichCallCount = 0;
    const enrichedIds: string[] = [];

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [emptyIdPerson, validPerson] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) => {
        enrichCallCount += 1;
        enrichedIds.push(apolloId);
        return Promise.resolve(makePerson(apolloId));
      }),
      score: vi.fn().mockResolvedValue({ score: 80, reasons: ["ok"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );

    // enrich must only have been called for good2
    expect(enrichCallCount).toBe(1);
    expect(enrichedIds).not.toContain("");
    // Only good2 in results
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.apolloId).toBe("good2");
  });

  // -------------------------------------------------------------------------
  // P2-5: All enrich calls fail → throw
  // -------------------------------------------------------------------------

  it("P2-5: throws when every enrich call fails (100% failure rate)", async () => {
    const p1 = makePerson("a1");
    const p2 = makePerson("a2");
    const p3 = makePerson("a3");

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1, p2, p3] }),
      enrich: vi.fn().mockRejectedValue(new Error("Apollo quota exceeded")),
      score: vi.fn().mockResolvedValue({ score: 80, reasons: ["ok"] }),
    };

    await expect(
      runSourcingForIcp("ria-us", BASE_FILTERS, DEFAULT_TIER_THRESHOLDS, 10, deps),
    ).rejects.toThrow("every Apollo enrichment failed");
  });

  it("P2-5: does NOT throw when only some (but not all) enrich calls fail", async () => {
    const p1 = makePerson("ok1");
    const p2 = makePerson("fail1");

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [p1, p2] }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) => {
        if (apolloId === "fail1") return Promise.reject(new Error("timeout"));
        return Promise.resolve(makePerson(apolloId));
      }),
      score: vi.fn().mockResolvedValue({ score: 80, reasons: ["ok"] }),
    };

    // Should NOT throw — partial failure is expected
    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );
    expect(result.candidates).toHaveLength(1);
    expect(result.stats.enrichFailed).toBe(1);
    expect(result.stats.enrichAttempted).toBe(2);
  });

  // -------------------------------------------------------------------------
  // Nominal stats check
  // -------------------------------------------------------------------------

  it("stats are coherent on a nominal run (searched/enrichAttempted/kept)", async () => {
    const people = [makePerson("s1"), makePerson("s2"), makePerson("s3")];

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people }),
      enrich: vi.fn().mockImplementation(({ apolloId }: { apolloId: string }) =>
        Promise.resolve(makePerson(apolloId)),
      ),
      score: vi.fn().mockResolvedValue({ score: 90, reasons: ["great"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      10,
      deps,
    );

    expect(result.stats.searched).toBe(3);
    expect(result.stats.enrichAttempted).toBe(3);
    expect(result.stats.enrichFailed).toBe(0);
    expect(result.stats.rejectedUnverified).toBe(0);
    expect(result.stats.rejectedTier).toBe(0);
    expect(result.stats.dedupSkipped).toBe(0);
    expect(result.stats.kept).toBe(3);
    expect(result.candidates).toHaveLength(3);
  });

  // -------------------------------------------------------------------------
  // P2-3: apolloId stored is the search-result id (person.id), not enrich id
  // -------------------------------------------------------------------------

  it("P2-3: stores search-result apolloId (person.id), not enriched.id", async () => {
    const searchPerson = makePerson("search-id-1");
    // Simulate enrich returning a slightly different id (e.g. normalised by Apollo)
    const enrichedPerson = { ...makePerson("enrich-id-99"), id: "enrich-id-99" };

    const deps: SourcingDeps = {
      search: vi.fn().mockResolvedValue({ people: [searchPerson] }),
      enrich: vi.fn().mockResolvedValue(enrichedPerson),
      score: vi.fn().mockResolvedValue({ score: 85, reasons: ["fit"] }),
    };

    const result = await runSourcingForIcp(
      "ria-us",
      BASE_FILTERS,
      DEFAULT_TIER_THRESHOLDS,
      5,
      deps,
    );

    expect(result.candidates).toHaveLength(1);
    // Must store person.id (from search), not enriched.id
    expect(result.candidates[0]!.apolloId).toBe("search-id-1");
  });
});
