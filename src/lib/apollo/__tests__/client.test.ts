import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  searchPeople,
  enrichPerson,
  isSendableEmail,
  type ApolloFetch,
} from "@/lib/apollo/client";

/**
 * Apollo client unit tests — no network. A stub `ApolloFetch` is injected so we
 * assert on the request the client builds and on how it normalises responses.
 */

const KEY = "test-apollo-key";

/** Builds a stub fetch that returns `payload` as JSON with status 200. */
function okFetch(payload: unknown): { fetch: ApolloFetch; calls: Request[] } {
  const calls: Request[] = [];
  const fetchImpl = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(typeof url === "string" ? url : url.toString(), init));
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as ApolloFetch;
  return { fetch: fetchImpl, calls };
}

function errorFetch(status: number, body = "nope"): ApolloFetch {
  return vi.fn(async () => new Response(body, { status })) as unknown as ApolloFetch;
}

beforeEach(() => {
  process.env.APOLLO_API_KEY = KEY;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.APOLLO_API_KEY;
});

describe("searchPeople", () => {
  it("posts persona filters and normalises people", async () => {
    const { fetch, calls } = okFetch({
      people: [
        {
          id: "p1",
          first_name: "Jane",
          last_name: "Doe",
          title: "Family Office Principal",
          email: null,
          email_status: null,
          linkedin_url: "https://linkedin.com/in/janedoe",
          organization: {
            name: "Doe Capital",
            primary_domain: "doecapital.com",
            industry: "financial services",
          },
        },
      ],
      pagination: { total_entries: 42, page: 1, per_page: 25 },
    });

    const result = await searchPeople(
      {
        personTitles: ["family office", "RIA"],
        personLocations: ["United States"],
        organizationIndustries: ["wealth management"],
        organizationHeadcount: ["11,50"],
      },
      fetch,
    );

    expect(result.totalEntries).toBe(42);
    expect(result.people).toHaveLength(1);
    expect(result.people[0]).toMatchObject({
      id: "p1",
      firstName: "Jane",
      lastName: "Doe",
      organizationName: "Doe Capital",
      organizationDomain: "doecapital.com",
      email: null,
    });

    // Request shape: correct endpoint + the X-Api-Key header + mapped body keys.
    const req = calls[0]!;
    expect(req.url).toContain("/v1/mixed_people/search");
    expect(req.headers.get("X-Api-Key")).toBe(KEY);
    const sentBody = JSON.parse(await req.text());
    expect(sentBody.person_titles).toEqual(["family office", "RIA"]);
    expect(sentBody.organization_num_employees_ranges).toEqual(["11,50"]);
  });

  it("drops records without an id", async () => {
    const { fetch } = okFetch({
      people: [{ first_name: "NoId" }, { id: "ok", first_name: "Yes" }],
      pagination: { total_entries: 2 },
    });
    const result = await searchPeople({ personTitles: ["x"] }, fetch);
    expect(result.people).toHaveLength(1);
    expect(result.people[0]!.id).toBe("ok");
  });

  it("clamps perPage to Apollo's 100 ceiling", async () => {
    const { fetch, calls } = okFetch({ people: [], pagination: {} });
    await searchPeople({ personTitles: ["x"], perPage: 500 }, fetch);
    const sentBody = JSON.parse(await calls[0]!.text());
    expect(sentBody.per_page).toBe(100);
  });

  it("throws a descriptive error on non-2xx", async () => {
    await expect(
      searchPeople({ personTitles: ["x"] }, errorFetch(422, "bad query")),
    ).rejects.toThrow(/Apollo POST .* 422/);
  });

  it("throws when APOLLO_API_KEY is absent", async () => {
    delete process.env.APOLLO_API_KEY;
    const { fetch } = okFetch({ people: [] });
    await expect(searchPeople({ personTitles: ["x"] }, fetch)).rejects.toThrow(
      /APOLLO_API_KEY is not set/,
    );
  });
});

describe("enrichPerson", () => {
  it("matches by apolloId and returns a normalised person", async () => {
    const { fetch, calls } = okFetch({
      person: {
        id: "p1",
        first_name: "Jane",
        email: "jane@doecapital.com",
        email_status: "verified",
        organization: { name: "Doe Capital", primary_domain: "doecapital.com" },
      },
    });

    const person = await enrichPerson({ apolloId: "p1" }, fetch);
    expect(person?.email).toBe("jane@doecapital.com");
    expect(person?.emailStatus).toBe("verified");

    const sentBody = JSON.parse(await calls[0]!.text());
    expect(sentBody.id).toBe("p1");
    expect(sentBody.reveal_personal_emails).toBe(false);
    expect(calls[0]!.url).toContain("/v1/people/match");
  });

  it("returns null when Apollo has no match", async () => {
    const { fetch } = okFetch({ person: null });
    expect(await enrichPerson({ apolloId: "missing" }, fetch)).toBeNull();
  });
});

describe("isSendableEmail", () => {
  it("accepts only verified addresses", () => {
    expect(isSendableEmail({ email: "a@b.com", emailStatus: "verified" })).toBe(true);
    expect(isSendableEmail({ email: "a@b.com", emailStatus: "guessed" })).toBe(false);
    expect(isSendableEmail({ email: null, emailStatus: "verified" })).toBe(false);
    expect(isSendableEmail({ email: "a@b.com", emailStatus: null })).toBe(false);
  });
});
