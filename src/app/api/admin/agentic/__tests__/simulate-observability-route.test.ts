/**
 * Integration tests — POST /api/admin/agentic/simulate observability opt-in.
 *
 * The recorder is mocked so we assert the route's wiring (opt-in only, response
 * block, business guarantees unchanged) without touching Redis/memory.
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

const recordMock = vi.fn();
vi.mock("@/lib/agentic/observability/simulation-trace", () => ({
  recordAgenticSimulationTrace: (...args: unknown[]) => recordMock(...args),
}));

import { POST } from "@/app/api/admin/agentic/simulate/route";
import { requireAdmin } from "@/lib/auth/require-admin";

const mockRequireAdmin = vi.mocked(requireAdmin);

function makeRequest(body?: unknown): NextRequest {
  return new Request("http://localhost/api/admin/agentic/simulate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  }) as unknown as NextRequest;
}

describe("POST simulate — observability opt-in", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    recordMock.mockResolvedValue({ recorded: true, storage: "memory_fallback" });
  });

  it("does NOT record when observability is absent (default)", async () => {
    const res = await POST(makeRequest({ swarmId: "platform_reporting_swarm" }));
    const body = (await res.json()) as {
      sideEffects: boolean;
      businessSideEffects: boolean;
      observability: { requested: boolean; recorded: boolean };
    };
    expect(recordMock).not.toHaveBeenCalled();
    expect(body.observability.requested).toBe(false);
    expect(body.observability.recorded).toBe(false);
    expect(body.sideEffects).toBe(false);
    expect(body.businessSideEffects).toBe(false);
  });

  it("does NOT record when observability.record is false", async () => {
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        observability: { record: false },
      }),
    );
    const body = (await res.json()) as {
      observability: { requested: boolean; recorded: boolean };
    };
    expect(recordMock).not.toHaveBeenCalled();
    expect(body.observability.requested).toBe(false);
  });

  it("records metadata-only when opted in, surfacing storage", async () => {
    const res = await POST(
      makeRequest({
        swarmId: "vault_governance_swarm",
        actionId: "deploy_product",
        context: { hasHumanConfirmationToken: true },
        observability: { record: true },
      }),
    );
    const body = (await res.json()) as {
      readiness: { decision: string };
      observability: { requested: boolean; recorded: boolean; storage?: string };
      sideEffects: boolean;
    };
    expect(recordMock).toHaveBeenCalledTimes(1);
    // The recorder is fed metadata only — counts + codes + ids, never payload.
    const arg = recordMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(arg.swarmId).toBe("vault_governance_swarm");
    expect(arg.actionId).toBe("deploy_product");
    expect(arg.readinessOutcome).toBe("blocked");
    expect(Array.isArray(arg.auditReasonCodes)).toBe(true);
    expect(arg).not.toHaveProperty("context");
    expect(arg).not.toHaveProperty("prompt");
    // Forbidden stays blocked even with the token.
    expect(body.readiness.decision).toBe("blocked");
    expect(body.observability.requested).toBe(true);
    expect(body.observability.recorded).toBe(true);
    expect(body.observability.storage).toBe("memory_fallback");
    expect(body.sideEffects).toBe(false);
  });

  it("a store failure does not break the simulation (recorded:false reason)", async () => {
    recordMock.mockResolvedValue({ recorded: false, reason: "store_error" });
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        observability: { record: true },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      observability: { recorded: boolean; reason?: string };
      sideEffects: boolean;
    };
    expect(body.observability.recorded).toBe(false);
    expect(body.observability.reason).toBe("store_error");
    expect(body.sideEffects).toBe(false);
  });

  it("does NOT record for an unknown swarm (404 before any record)", async () => {
    const res = await POST(
      makeRequest({ swarmId: "nope", observability: { record: true } }),
    );
    expect(res.status).toBe(404);
    expect(recordMock).not.toHaveBeenCalled();
  });

  it("rejects a non-boolean observability.record (400)", async () => {
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        observability: { record: "yes" },
      }),
    );
    expect(res.status).toBe(400);
    expect(recordMock).not.toHaveBeenCalled();
  });
});
