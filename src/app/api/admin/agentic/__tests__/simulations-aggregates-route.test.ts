/**
 * Integration tests — GET /api/admin/agentic/simulations/aggregates.
 *
 * Auth + the store reader are mocked; the route runs the pure aggregator. No
 * Redis, no DB, no network.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

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

const readMock = vi.fn();
vi.mock("@/lib/agentic/observability/simulation-store", () => ({
  readSimulationTraces: (...args: unknown[]) => readMock(...args),
  SIMULATION_TRACES_CAP: 200,
}));

import { GET } from "@/app/api/admin/agentic/simulations/aggregates/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function req(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}
const BASE = "http://localhost/api/admin/agentic/simulations/aggregates";

const TRACES = [
  {
    id: "sim:1",
    createdAt: "2026-06-26T00:00:00.000Z",
    kind: "agentic_simulation",
    swarmId: "vault_governance_swarm",
    swarmMode: "dry_run",
    actionId: "deploy_product",
    readinessOutcome: "blocked",
    blockedCount: 5,
    gateCount: 0,
    confirmationCount: 0,
    auditReasonCodes: ["swarm_dry_run"],
    sideEffects: false,
    metadataOnly: true,
  },
  {
    id: "sim:2",
    createdAt: "2026-06-26T00:01:00.000Z",
    kind: "agentic_simulation",
    swarmId: "platform_reporting_swarm",
    swarmMode: "simulation",
    blockedCount: 3,
    gateCount: 0,
    confirmationCount: 0,
    auditReasonCodes: ["swarm_simulation"],
    sideEffects: false,
    metadataOnly: true,
  },
];

describe("GET /api/admin/agentic/simulations/aggregates", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    readMock.mockResolvedValue(TRACES);
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    const res = await GET(req(BASE));
    expect(res.status).toBe(403);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("returns 401 when authentication is required", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Authentication required"));
    expect((await GET(req(BASE))).status).toBe(401);
  });

  it("returns 200 with metadata-only aggregates and no-store", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await GET(req(BASE));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      available: boolean;
      aggregates: {
        metadataOnly: boolean;
        totals: { simulations: number; blocked: number };
        bySwarm: { swarmId: string; count: number }[];
        byMode: { mode: string; count: number }[];
      };
    };
    expect(body.available).toBe(true);
    expect(body.aggregates.metadataOnly).toBe(true);
    expect(body.aggregates.totals.simulations).toBe(2);
    expect(body.aggregates.totals.blocked).toBe(8);
    expect(body.aggregates.bySwarm.length).toBe(2);
    expect(body.aggregates.byMode.length).toBe(2);
  });

  it("does not embed raw trace bodies (no id/createdAt in aggregates)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const text = JSON.stringify(await (await GET(req(BASE))).json());
    expect(text).not.toContain("sim:1");
    expect(text).not.toContain("createdAt");
  });

  it("clamps limit to the cap", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    await GET(req(`${BASE}?limit=99999`));
    expect(readMock).toHaveBeenCalledWith(200);
  });

  it("rejects a non-positive limit (400)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    expect((await GET(req(`${BASE}?limit=0`))).status).toBe(400);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid window (400)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    expect((await GET(req(`${BASE}?window=9001y`))).status).toBe(400);
  });

  it("returns a safe available:false (no stack/secret) when the store throws", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    readMock.mockRejectedValue(new Error("redis exploded sk-secret"));
    const res = await GET(req(BASE));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      available: boolean;
      reason: string;
      aggregates: { metadataOnly: boolean };
    };
    expect(body.available).toBe(false);
    expect(body.reason).toBe("store_unavailable");
    expect(body.aggregates.metadataOnly).toBe(true);
    expect(JSON.stringify(body)).not.toContain("sk-secret");
  });
});
