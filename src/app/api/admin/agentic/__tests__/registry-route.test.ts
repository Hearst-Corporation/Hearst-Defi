/**
 * Integration tests for GET /api/admin/agentic/registry.
 *
 * Auth + logger are mocked so the test runs without a real session. The route
 * itself touches NO DB / network — it serializes pure registries.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { GET } from "@/app/api/admin/agentic/registry/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { assertRateLimit } from "@/lib/rate-limit";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockRateLimit = vi.mocked(assertRateLimit);

describe("GET /api/admin/agentic/registry", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 when requireAdmin rejects (non-admin)", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 401 when authentication is required", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Authentication required"));
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 429 when the read rate limit is exceeded", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
    mockRateLimit.mockRejectedValue(new Error("rate limited"));
    const res = await GET();
    expect(res.status).toBe(429);
  });

  it("returns 200 with the full registry snapshot + sideEffects:false", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");

    const body = (await res.json()) as {
      snapshot: {
        agents: unknown[];
        crews: unknown[];
        swarms: { id: string; mode: string }[];
        actions: unknown[];
        safety: {
          allowedSwarmModes: string[];
          disallowedSwarmModes: string[];
          simulationOnly: boolean;
          noExternalTools: boolean;
        };
      };
      sideEffects: boolean;
    };

    expect(body.sideEffects).toBe(false);
    expect(body.snapshot.swarms.length).toBe(5);
    expect(body.snapshot.crews.length).toBeGreaterThan(0);
    expect(body.snapshot.agents.length).toBeGreaterThan(0);
    expect(body.snapshot.actions.length).toBeGreaterThan(0);

    // Safety metadata advertises the allowed modes and excludes autonomous_write.
    expect(body.snapshot.safety.allowedSwarmModes).toEqual([
      "simulation",
      "dry_run",
      "gated",
    ]);
    expect(body.snapshot.safety.disallowedSwarmModes).toContain(
      "autonomous_write",
    );
    expect(body.snapshot.safety.simulationOnly).toBe(true);
    expect(body.snapshot.safety.noExternalTools).toBe(true);

    // No swarm mode is autonomous_write.
    for (const s of body.snapshot.swarms) {
      expect(["simulation", "dry_run", "gated"]).toContain(s.mode);
    }
  });

  it("never serializes a wall-clock timestamp or a user-content field", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" } as never);
    const res = await GET();
    const body = (await res.json()) as { snapshot: Record<string, unknown> };
    const text = JSON.stringify(body);
    // Deterministic: no wall-clock timestamp anywhere.
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    // The snapshot exposes only the four registry sections + safety — it carries
    // no user-content payload (no message/prompt body, no user-supplied text).
    // It is built purely from static registries, so by construction it cannot
    // echo any request input (GET has none).
    expect(Object.keys(body.snapshot).sort()).toEqual([
      "actions",
      "agents",
      "crews",
      "safety",
      "swarms",
    ]);
  });
});
