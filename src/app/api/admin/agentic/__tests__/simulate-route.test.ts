/**
 * Integration tests for POST /api/admin/agentic/simulate.
 *
 * Auth, rate-limit, and logger are mocked. The route runs the pure
 * simulateSwarm / evaluateActionReadiness — no DB, no network, no tool call,
 * no real execution, no HITL token generated.
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

describe("POST /api/admin/agentic/simulate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 403 for a non-admin", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));
    const res = await POST(makeRequest({ swarmId: "platform_reporting_swarm" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 on invalid JSON", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const bad = new Request("http://localhost/api/admin/agentic/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    }) as unknown as NextRequest;
    const res = await POST(bad);
    expect(res.status).toBe(400);
  });

  it("returns 400 when swarmId is missing", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(makeRequest({ actionId: "x" }));
    expect(res.status).toBe(400);
  });

  it("returns 404 for an unknown swarm (fail-safe, no fallback execution)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(makeRequest({ swarmId: "does_not_exist" }));
    expect(res.status).toBe(404);
    const body = (await res.json()) as { kind: string; sideEffects: boolean };
    expect(body.kind).toBe("unknown_swarm");
    expect(body.sideEffects).toBe(false);
  });

  it("simulates a valid swarm with sideEffects:false and no-store", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(makeRequest({ swarmId: "platform_reporting_swarm" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const body = (await res.json()) as {
      swarm: { id: string; mode: string };
      steps: { executable: boolean }[];
      sideEffects: boolean;
      readiness: unknown;
    };
    expect(body.sideEffects).toBe(false);
    expect(body.swarm.id).toBe("platform_reporting_swarm");
    expect(body.steps.every((s) => s.executable === false)).toBe(true);
    expect(body.readiness).toBeNull();
  });

  it("is deterministic — identical body yields identical response", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const a = await (
      await POST(makeRequest({ swarmId: "vault_governance_swarm" }))
    ).json();
    const b = await (
      await POST(makeRequest({ swarmId: "vault_governance_swarm" }))
    ).json();
    expect(a).toEqual(b);
  });

  it("blocks a forbidden action even with a confirmation token", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "vault_governance_swarm",
        actionId: "deploy_product",
        context: { hasHumanConfirmationToken: true },
      }),
    );
    const body = (await res.json()) as {
      readiness: { decision: string; reasonCode: string };
    };
    expect(body.readiness.decision).toBe("blocked");
    expect(body.readiness.reasonCode).toBe("forbidden_autonomous");
  });

  it("requires human confirmation for confirmed_write without a token (unscoped swarm)", async () => {
    // platform_reporting_swarm has no enforced scope, so a confirmed_write action
    // falls through to the tier decision (requires_human_confirmation without a
    // token). The scoped outreach swarm's forbidden-by-swarm behaviour is covered
    // by the boundary-enforcement test suite.
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        actionId: "outreach_trigger_send_run",
      }),
    );
    const body = (await res.json()) as { readiness: { decision: string } };
    expect(body.readiness.decision).toBe("requires_human_confirmation");
  });

  it("enforces the outreach swarm scope: the send-run is blocked by the swarm even with a token", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "outreach_governed_swarm",
        actionId: "outreach_trigger_send_run",
        context: { hasHumanConfirmationToken: true },
      }),
    );
    const body = (await res.json()) as {
      readiness: { decision: string; reasonCode: string; swarmScoped: boolean };
    };
    expect(body.readiness.decision).toBe("blocked");
    expect(body.readiness.reasonCode).toBe("forbidden_by_swarm");
    expect(body.readiness.swarmScoped).toBe(true);
  });

  it("enforces the outreach swarm scope: an out-of-scope read action is blocked", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "outreach_governed_swarm",
        actionId: "read_observability",
      }),
    );
    const body = (await res.json()) as {
      readiness: { decision: string; reasonCode: string };
    };
    expect(body.readiness.decision).toBe("blocked");
    expect(body.readiness.reasonCode).toBe("action_out_of_swarm_scope");
  });

  it("allows an in-scope read action and gates an in-scope draft on the outreach swarm", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const ro = await POST(
      makeRequest({
        swarmId: "outreach_governed_swarm",
        actionId: "navigate_admin_surface",
      }),
    );
    expect(((await ro.json()) as { readiness: { decision: string } }).readiness.decision).toBe("allow");
    const draft = await POST(
      makeRequest({
        swarmId: "outreach_governed_swarm",
        actionId: "draft_outreach_email",
      }),
    );
    expect(((await draft.json()) as { readiness: { decision: string } }).readiness.decision).toBe("gated");
  });

  it("blocks an unknown write-like action (fail-safe)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        actionId: "send_money_now",
      }),
    );
    const body = (await res.json()) as {
      readiness: { decision: string; unknown: boolean };
    };
    expect(body.readiness.decision).toBe("blocked");
    expect(body.readiness.unknown).toBe(true);
  });

  it("rejects a non-boolean confirmation token (400)", async () => {
    mockRequireAdmin.mockResolvedValue({ userId: "a" } as never);
    const res = await POST(
      makeRequest({
        swarmId: "platform_reporting_swarm",
        context: { hasHumanConfirmationToken: "yes" },
      }),
    );
    expect(res.status).toBe(400);
  });
});
