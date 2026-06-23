/**
 * Unit test for the runSourcing server action (src/app/admin/outreach/actions.ts).
 * Pins the A→Z persistence contract: when the Master tool sources leads, the
 * Apollo enrichment fields (linkedinUrl / companyDomain / industry / emailStatus
 * / apolloData) carried by each SourcedCandidate are PERSISTED on the new
 * OutreachProspect rows — they are not dropped. Also pins dedupe (existing +
 * suppressed emails skipped) and the by-tier summary.
 *
 * Everything I/O is mocked at the module boundary — no real Apollo, no real DB,
 * no email.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const prospectFindManyMock = vi.fn(async () => [] as { email?: string; apolloId?: string }[]);
const prospectCreateMock = vi.fn(
  async (_args: { data: Record<string, unknown> }) => ({ id: "new" }),
);
const suppressionFindManyMock = vi.fn(async () => [] as { email: string }[]);
const icpFindUniqueMock = vi.fn(async () => ({
  id: "icp_1",
  name: "US Family Offices",
  tierAMin: 85,
  tierBMin: 60,
  tierCMin: 40,
}));
const auditCreateMock = vi.fn(async () => ({}));

const runSourcingForIcpMock = vi.fn();

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(async () => ({ userId: "admin_1", walletAddress: "0xadmin" })),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/email/send", () => ({
  sendTrackedEmail: vi.fn(async () => ({ id: "x" })),
  renderPlainHtml: (b: string) => b,
}));
vi.mock("@/lib/outreach/suppression", () => ({ isSuppressed: vi.fn(async () => false) }));
vi.mock("@/lib/outreach/cta-url", () => ({ resolveCtaUrl: () => "https://app.test/apply" }));
vi.mock("@/lib/hubspot/sync-prospect", () => ({
  upsertProspectContact: vi.fn(async () => undefined),
  logEmailActivity: vi.fn(async () => undefined),
}));
vi.mock("@/lib/agents/outreach-writer", () => ({
  draftColdEmail: vi.fn(async () => ({ subject: "s", body: "b" })),
  draftNewsletter: vi.fn(async () => ({ subject: "s", body: "b" })),
}));
vi.mock("@/lib/inngest/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

// Keep the real serde, stub only the sourcing runner so no Apollo is hit.
vi.mock("@/lib/outreach/icp", () => ({
  serializeList: () => "",
  parseIcpFilters: () => ({
    titles: [],
    seniorities: [],
    locations: [],
    industries: [],
    headcount: [],
    keywords: [],
  }),
  runSourcingForIcp: runSourcingForIcpMock,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    outreachICP: { findUnique: icpFindUniqueMock },
    outreachProspect: { findMany: prospectFindManyMock, create: prospectCreateMock },
    outreachSuppression: { findMany: suppressionFindManyMock },
    adminAudit: { create: auditCreateMock },
  },
}));

function candidate(over: Record<string, unknown> = {}) {
  return {
    email: "Partner@Acme.Example",
    firstName: "Dana",
    lastName: "Lee",
    company: "Acme Capital",
    title: "Managing Partner",
    apolloId: "apollo_1",
    linkedinUrl: "https://linkedin.com/in/danalee",
    companyDomain: "acme.example",
    industry: "financial services",
    emailStatus: "verified",
    apolloData: JSON.stringify({ id: "apollo_1", city: "Geneva" }),
    qualScore: 72,
    tier: "B" as const,
    ...over,
  };
}

describe("runSourcing — persists Apollo enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prospectFindManyMock.mockResolvedValue([]);
    suppressionFindManyMock.mockResolvedValue([]);
  });

  it("creates a prospect carrying the full Apollo enrichment snapshot", async () => {
    runSourcingForIcpMock.mockResolvedValue({
      candidates: [candidate()],
      isMock: false,
      stats: { searched: 1, enrichFailed: 0, dedupSkipped: 0 },
    });

    const { runSourcing } = await import("@/app/admin/outreach/actions");
    const res = await runSourcing("icp_1", 10);

    expect(prospectCreateMock).toHaveBeenCalledTimes(1);
    const data = prospectCreateMock.mock.calls[0]![0].data;
    // Email normalised to lowercase, source apollo, ICP linked.
    expect(data.email).toBe("partner@acme.example");
    expect(data.source).toBe("apollo");
    expect(data.icpId).toBe("icp_1");
    // The enrichment fields are PERSISTED (the whole point of the CRM sheet).
    expect(data.linkedinUrl).toBe("https://linkedin.com/in/danalee");
    expect(data.companyDomain).toBe("acme.example");
    expect(data.industry).toBe("financial services");
    expect(data.emailStatus).toBe("verified");
    expect(data.apolloData).toContain("Geneva");
    expect(data.tier).toBe("B");
    expect(data.qualScore).toBe(72);

    expect(res.sourced).toBe(1);
    expect(res.byTier.B).toBe(1);
  });

  it("skips candidates whose email already exists or is suppressed (no create)", async () => {
    prospectFindManyMock.mockResolvedValue([{ email: "partner@acme.example" }]);
    runSourcingForIcpMock.mockResolvedValue({
      candidates: [candidate()],
      isMock: false,
      stats: { searched: 1, enrichFailed: 0, dedupSkipped: 0 },
    });

    const { runSourcing } = await import("@/app/admin/outreach/actions");
    const res = await runSourcing("icp_1", 10);

    expect(prospectCreateMock).not.toHaveBeenCalled();
    expect(res.sourced).toBe(0);
    expect(res.skipped).toBe(1);
  });
});
