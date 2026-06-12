/**
 * Integration tests for /api/admin/review-mode
 *
 * Every external dependency is mocked (auth, db, rate-limit, logger) so that
 * the tests run without a real DB, Redis, or Privy session.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

// ── Hoist mocks before module imports ─────────────────────────────────────

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    adminChatMode: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// ── Import modules AFTER mocks are set up ─────────────────────────────────

import { GET, POST } from "@/app/api/admin/review-mode/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { assertRateLimit } from "@/lib/rate-limit";

// ── Typed mock helpers ─────────────────────────────────────────────────────

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockFindUnique = vi.mocked(prisma.adminChatMode.findUnique);
const mockUpsert = vi.mocked(prisma.adminChatMode.upsert);
const mockAssertRateLimit = vi.mocked(assertRateLimit);

// ── Helper: build a minimal NextRequest ───────────────────────────────────

function makeRequest(
  method: string,
  body?: unknown,
): NextRequest {
  return new Request("http://localhost/api/admin/review-mode", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as unknown as NextRequest;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("GET /api/admin/review-mode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Default: assertRateLimit resolves
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it("returns 403 when requireAdmin rejects (non-admin)", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));

    const res = await GET();

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it("returns 200 with mode 'normal' when no row exists in DB", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockFindUnique.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body).toEqual({ mode: "normal" });
  });

  it("returns 200 with mode 'review' when row has mode='review'", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockFindUnique.mockResolvedValue({ mode: "review" } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body).toEqual({ mode: "review" });
  });

  it("returns 200 with mode 'admin' when row has mode='admin'", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockFindUnique.mockResolvedValue({ mode: "admin" } as never);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body).toEqual({ mode: "admin" });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockAssertRateLimit.mockRejectedValue(new Error("Rate limit exceeded. Try again in 30s."));

    const res = await GET();

    expect(res.status).toBe(429);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });
});

describe("POST /api/admin/review-mode", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAssertRateLimit.mockResolvedValue(undefined);
  });

  it("returns 400 when body has an invalid mode value", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });

    const req = makeRequest("POST", { mode: "wat" });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });

  it("returns 200 and calls upsert with mode='review' on valid body", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockUpsert.mockResolvedValue({
      id: "1",
      userId: "admin_123",
      mode: "review",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const req = makeRequest("POST", { mode: "review" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body).toEqual({ mode: "review" });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { mode: "review" },
        create: expect.objectContaining({ mode: "review" }),
      }),
    );
  });

  it("returns 200 and calls upsert with mode='admin' on valid body", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockUpsert.mockResolvedValue({
      id: "1",
      userId: "admin_123",
      mode: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
    } as never);

    const req = makeRequest("POST", { mode: "admin" });
    const res = await POST(req);

    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body).toEqual({ mode: "admin" });

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { mode: "admin" },
        create: expect.objectContaining({ mode: "admin" }),
      }),
    );
  });

  it("returns 500 when the DB upsert rejects", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_123" });
    mockUpsert.mockRejectedValue(new Error("DB connection lost"));

    const req = makeRequest("POST", { mode: "normal" });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toBeDefined();
  });
});
