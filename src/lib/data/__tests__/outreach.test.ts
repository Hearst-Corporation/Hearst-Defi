/**
 * Tests for loadProspectDetail — the CRM prospect-sheet loader. Pins the mapped
 * shape (identity + Apollo enrichment + qualification + email history + replies),
 * the ICP-name resolution, tolerant parsing of tags/apolloData, and null-safety
 * (nothing should surface as undefined). Prisma is mocked at the @/lib/db
 * boundary — no real DB.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prospectFindUniqueMock = vi.fn();
const icpFindUniqueMock = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachProspect: { findUnique: prospectFindUniqueMock },
    outreachICP: { findUnique: icpFindUniqueMock },
  },
}));

async function load(id: string) {
  return (await import("@/lib/data/outreach")).loadProspectDetail(id);
}

const NOW = new Date("2026-06-23T10:00:00Z");

/** A fully-populated Apollo-sourced prospect with one email + one reply. */
function richProspect() {
  return {
    id: "p1",
    email: "partner@acme.example",
    firstName: "Dana",
    lastName: "Lee",
    company: "Acme Capital",
    title: "Managing Partner",
    source: "apollo",
    status: "replied",
    tags: JSON.stringify(["family-office", "tier-b"]),
    notes: "Met at conference.",
    hubspotContactId: "hs_1",
    apolloId: "apollo_1",
    linkedinUrl: "https://linkedin.com/in/danalee",
    companyDomain: "acme.example",
    industry: "financial services",
    emailStatus: "verified",
    apolloData: JSON.stringify({ id: "apollo_1", seniority: "owner", city: "Geneva" }),
    qualScore: 72,
    tier: "B",
    icpId: "icp_1",
    sequenceStep: 1,
    lastContactedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    emails: [
      {
        id: "e1",
        campaignId: "c1",
        campaign: { name: "Q3 Family Offices" },
        subject: "Intro to Hearst",
        status: "sent",
        draftedByAgent: true,
        tierAtSend: "B",
        sentAt: NOW,
        createdAt: NOW,
        events: [{ type: "opened", occurredAt: NOW }],
      },
    ],
    replies: [
      {
        id: "r1",
        fromEmail: "partner@acme.example",
        subject: "Re: Intro",
        body: "Interested, tell me more.",
        intent: "interested",
        confidence: 88,
        actionTaken: "qualify",
        handledAt: NOW,
        createdAt: NOW,
      },
    ],
  };
}

describe("loadProspectDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when the prospect does not exist", async () => {
    prospectFindUniqueMock.mockResolvedValue(null);
    expect(await load("nope")).toBeNull();
  });

  it("maps a rich Apollo prospect: identity, enrichment, qualification, history", async () => {
    prospectFindUniqueMock.mockResolvedValue(richProspect());
    icpFindUniqueMock.mockResolvedValue({ name: "US Family Offices" });

    const d = await load("p1");
    expect(d).not.toBeNull();
    if (!d) return;

    // Identity + enrichment
    expect(d.email).toBe("partner@acme.example");
    expect(d.linkedinUrl).toBe("https://linkedin.com/in/danalee");
    expect(d.companyDomain).toBe("acme.example");
    expect(d.industry).toBe("financial services");
    expect(d.emailStatus).toBe("verified");
    // Parsed JSON helpers
    expect(d.tags).toEqual(["family-office", "tier-b"]);
    expect(d.apolloData).toEqual({ id: "apollo_1", seniority: "owner", city: "Geneva" });
    // Qualification + ICP name resolution
    expect(d.tier).toBe("B");
    expect(d.qualScore).toBe(72);
    expect(d.icpName).toBe("US Family Offices");
    // Email history (latest event + agent flag + campaign name)
    expect(d.emails).toHaveLength(1);
    expect(d.emails[0]!.campaignName).toBe("Q3 Family Offices");
    expect(d.emails[0]!.latestEventType).toBe("opened");
    expect(d.emails[0]!.draftedByAgent).toBe(true);
    expect(d.emails[0]!.tierAtSend).toBe("B");
    // Replies (intent + confidence + action)
    expect(d.replies).toHaveLength(1);
    expect(d.replies[0]!.intent).toBe("interested");
    expect(d.replies[0]!.confidence).toBe(88);
    expect(d.replies[0]!.actionTaken).toBe("qualify");
  });

  it("degrades honestly for a manual prospect (no Apollo, no relations, malformed tags)", async () => {
    prospectFindUniqueMock.mockResolvedValue({
      ...richProspect(),
      source: "manual",
      apolloId: null,
      linkedinUrl: null,
      companyDomain: null,
      industry: null,
      emailStatus: null,
      apolloData: "{not valid json", // malformed → null, never throws
      tags: null, // → []
      icpId: null, // → icpName null, no ICP query
      tier: null,
      qualScore: null,
      emails: [],
      replies: [],
    });

    const d = await load("p1");
    expect(d).not.toBeNull();
    if (!d) return;

    expect(d.apolloData).toBeNull();
    expect(d.tags).toEqual([]);
    expect(d.icpName).toBeNull();
    expect(icpFindUniqueMock).not.toHaveBeenCalled(); // no icpId → no lookup
    expect(d.tier).toBeNull();
    expect(d.emails).toEqual([]);
    expect(d.replies).toEqual([]);
    // No field is undefined — every key resolves to a value or null.
    for (const v of Object.values(d)) expect(v).not.toBeUndefined();
  });

  it("tolerates a null campaign relation on an email row", async () => {
    const p = richProspect();
    p.emails[0]!.campaign = null as unknown as { name: string };
    p.emails[0]!.events = [];
    prospectFindUniqueMock.mockResolvedValue(p);
    icpFindUniqueMock.mockResolvedValue({ name: "X" });

    const d = await load("p1");
    expect(d?.emails[0]!.campaignName).toBeNull();
    expect(d?.emails[0]!.latestEventType).toBeNull();
  });
});
