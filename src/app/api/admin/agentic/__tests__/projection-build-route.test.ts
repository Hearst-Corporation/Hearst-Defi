/**
 * Integration tests — POST /api/admin/agentic/projection.
 *
 * Auth + rate-limit + logger mocked; the route runs the pure projection engine.
 * No DB, no network, no external tool.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/admin/agentic/projection/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function makeRequest(body?: unknown): NextRequest {
  return new Request("http://localhost/api/admin/agentic/projection", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as unknown as NextRequest;
}

const VALID = {
  productName: "Hearst Yield Vault",
  productType: "vault",
  capitalBase: 1_000_000,
  currency: "USDC",
  apyRange: { min: 8, max: 15 },
  horizonMonths: 12,
};

describe("POST /api/admin/agentic/projection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    expect((await POST(makeRequest(VALID))).status).toBe(403);
  });

  it("returns 400 on invalid input", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    expect((await POST(makeRequest({ productName: "X" }))).status).toBe(400);
    const badJson = new Request("http://localhost/x", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }) as unknown as NextRequest;
    expect((await POST(badJson)).status).toBe(400);
  });

  it("returns 200 with a guarded, side-effect-free artifact", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(makeRequest(VALID));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      artifact: {
        mode: string;
        sideEffects: boolean;
        metrics: { id: string; range?: unknown }[];
        disclaimers: string[];
      };
      sideEffects: boolean;
      businessSideEffects: boolean;
    };
    expect(body.sideEffects).toBe(false);
    expect(body.businessSideEffects).toBe(false);
    expect(body.artifact.mode).toBe("read_only_projection");
    expect(body.artifact.disclaimers.length).toBeGreaterThanOrEqual(3);
    // APY metric is a range, not a point.
    const apy = body.artifact.metrics.find((m) => m.id === "target_apy")!;
    expect(apy.range).toEqual({ min: 8, max: 15, unit: "%" });
  });

  it("does not leak prompt/user text or a raw conversation payload", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({ ...VALID, prompt: "LEAK_ME", rawConversation: "SECRET_TEXT" }),
    );
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("LEAK_ME");
    expect(text).not.toContain("SECRET_TEXT");
  });

  it("never emits a forbidden word or a guaranteed-return claim", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const text = JSON.stringify(await (await POST(makeRequest(VALID))).json());
    for (const w of ["guarantee", "promise", "risk-free"]) {
      expect(text.toLowerCase()).not.toContain(w);
    }
  });
});
