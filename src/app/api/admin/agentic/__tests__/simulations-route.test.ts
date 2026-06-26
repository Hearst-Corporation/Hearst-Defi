/**
 * Integration tests — GET /api/admin/agentic/simulations.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const readMock = vi.fn();
vi.mock("@/lib/agentic/observability/simulation-store", () => ({
  readSimulationTraces: (...args: unknown[]) => readMock(...args),
  SIMULATION_TRACES_CAP: 200,
}));

import { GET } from "@/app/api/admin/agentic/simulations/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function makeRequest(url: string): NextRequest {
  return new Request(url, { method: "GET" }) as unknown as NextRequest;
}

const BASE = "http://localhost/api/admin/agentic/simulations";

describe("GET /api/admin/agentic/simulations", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    readMock.mockResolvedValue([
      {
        id: "sim:1",
        createdAt: "2026-01-01T00:00:00.000Z",
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
    ]);
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    const res = await GET(makeRequest(BASE));
    expect(res.status).toBe(403);
    expect(readMock).not.toHaveBeenCalled();
  });

  it("returns 200 with metadata-only traces and no-store", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await GET(makeRequest(BASE));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      traces: { metadataOnly: boolean }[];
      count: number;
      metadataOnly: boolean;
    };
    expect(body.metadataOnly).toBe(true);
    expect(body.count).toBe(1);
    expect(body.traces[0]!.metadataOnly).toBe(true);
  });

  it("clamps limit to the cap", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    await GET(makeRequest(`${BASE}?limit=99999`));
    expect(readMock).toHaveBeenCalledWith(200);
  });

  it("rejects a non-positive limit (400)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await GET(makeRequest(`${BASE}?limit=0`));
    expect(res.status).toBe(400);
    expect(readMock).not.toHaveBeenCalled();
  });
});
