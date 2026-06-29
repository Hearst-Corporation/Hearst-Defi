import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { POST } from "@/app/api/admin/diagnostics/chat-router/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function makeRequest(): NextRequest {
  return new Request("http://localhost/api/admin/diagnostics/chat-router", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  }) as unknown as NextRequest;
}

describe("POST /api/admin/diagnostics/chat-router", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    const res = await POST(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 200 + no-store + a real dry-run suite for an admin", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      suite: string;
      mode: string;
      externalSideEffects: boolean;
      dbWrites: string;
      summary: { fail: number; total: number };
    };
    expect(body.suite).toBe("chat-router");
    expect(body.mode).toBe("dry-run");
    expect(body.externalSideEffects).toBe(false);
    expect(body.dbWrites).toBe("none");
    expect(body.summary.fail).toBe(0);
    expect(body.summary.total).toBeGreaterThan(0);
  });
});
