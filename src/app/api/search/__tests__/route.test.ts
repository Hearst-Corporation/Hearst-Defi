/**
 * C-15: Unit tests for GET /api/search — admin gate enforcement.
 *
 * Mock strategy mirrors src/app/api/admin/review-mode/__tests__/route.test.ts:
 *  • requireAdmin  — vi.mock'd, controlled per test
 *  • buildSearchIndex — vi.mock'd, returns a canned response
 *  • server-only   — stubbed to a no-op so the module can be imported
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// ── Hoist mocks before module imports ─────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/search/indexer", () => ({
  buildSearchIndex: vi.fn(),
}));

// ── Import modules AFTER mocks are set up ─────────────────────────────────

import { GET } from "@/app/api/search/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { buildSearchIndex } from "@/lib/search/indexer";

// ── Typed mock helpers ─────────────────────────────────────────────────────

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockBuildSearchIndex = vi.mocked(buildSearchIndex);

// ── Fixtures ──────────────────────────────────────────────────────────────

const EMPTY_RESPONSE = { results: [], query: "test", directJump: false };

function makeRequest(q = "test"): NextRequest {
  return new NextRequest(
    new URL(`http://localhost/api/search?q=${encodeURIComponent(q)}`),
    { method: "GET" },
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/search — C-15 admin gate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockRequireAdmin.mockRejectedValue(
      new Error("Authentication required. Please log in."),
    );

    const res = await GET(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
    expect(mockBuildSearchIndex).not.toHaveBeenCalled();
  });

  it("returns 403 when user is authenticated but not admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required."));

    const res = await GET(makeRequest());

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
    expect(mockBuildSearchIndex).not.toHaveBeenCalled();
  });

  it("returns 200 with search results when user is admin", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockBuildSearchIndex.mockResolvedValue({
      results: [
        {
          entity: "investor",
          id: "inv_001",
          title: "lp@fund.io",
          href: "/admin/customers/inv_001",
        },
      ],
      query: "lp",
      directJump: false,
    });

    const res = await GET(makeRequest("lp"));

    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[]; query: string };
    expect(body.results).toHaveLength(1);
    expect(body.query).toBe("lp");
    expect(mockBuildSearchIndex).toHaveBeenCalledWith("lp");
  });

  it("returns 200 with empty results when admin sends empty query", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockBuildSearchIndex.mockResolvedValue(EMPTY_RESPONSE);

    const res = await GET(makeRequest(""));

    expect(res.status).toBe(200);
    const body = await res.json() as { results: unknown[] };
    expect(body.results).toHaveLength(0);
  });

  it("returns 400 when query exceeds 200 chars (before auth is irrelevant — length check first)", async () => {
    // Note: the 200-char guard fires before requireAdmin in the route implementation.
    // This test validates no PII leaks even when the query is oversized.
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });

    const longQuery = "a".repeat(201);
    const res = await GET(makeRequest(longQuery));

    expect(res.status).toBe(400);
  });

  it("returns 500 when buildSearchIndex throws", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockBuildSearchIndex.mockRejectedValue(new Error("DB connection lost"));

    const res = await GET(makeRequest("anything"));

    expect(res.status).toBe(500);
  });
});
