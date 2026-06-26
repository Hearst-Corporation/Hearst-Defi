/**
 * Unit tests — agentic simulation observability (trace builder + recorder).
 *
 * Redis is mocked absent so the store falls back to the in-memory buffer; no
 * real network, no DB, no Prisma. Asserts the metadata-only contract and the
 * fail-safe recorder behaviour.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/rate-limit", () => ({
  getRedis: vi.fn(() => null), // no Redis → memory fallback
}));

vi.mock("@/lib/logger", () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  buildSimulationTrace,
  recordAgenticSimulationTrace,
  type SimulationTraceInput,
} from "../simulation-trace";
import {
  readSimulationTraces,
  __resetSimulationMemBuffer,
} from "../simulation-store";

const baseInput: SimulationTraceInput = {
  swarmId: "vault_governance_swarm",
  swarmMode: "dry_run",
  actionId: "deploy_product",
  readinessOutcome: "blocked",
  blockedCount: 5,
  gateCount: 0,
  confirmationCount: 0,
  auditReasonCodes: ["swarm_dry_run", "crew_read_only"],
};

describe("buildSimulationTrace (pure, metadata-only)", () => {
  it("copies only allowlisted metadata — no payload smuggling", () => {
    const dirty = {
      ...baseInput,
      // Attempt to smuggle forbidden fields:
      prompt: "secret user prompt",
      userText: "hello",
      rawBody: { token: "sk-abc" },
    } as unknown as SimulationTraceInput;
    const trace = buildSimulationTrace(dirty, {
      id: "sim:1",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const keys = Object.keys(trace).sort();
    expect(keys).toEqual(
      [
        "actionId",
        "auditReasonCodes",
        "blockedCount",
        "confirmationCount",
        "createdAt",
        "gateCount",
        "id",
        "kind",
        "metadataOnly",
        "readinessOutcome",
        "sideEffects",
        "swarmId",
        "swarmMode",
      ].sort(),
    );
    const json = JSON.stringify(trace);
    expect(json).not.toContain("prompt");
    expect(json).not.toContain("userText");
    expect(json).not.toContain("sk-abc");
    expect(trace.sideEffects).toBe(false);
    expect(trace.metadataOnly).toBe(true);
    expect(trace.kind).toBe("agentic_simulation");
  });

  it("is deterministic given the same input + stamp", () => {
    const stamp = { id: "sim:x", createdAt: "2026-01-01T00:00:00.000Z" };
    expect(buildSimulationTrace(baseInput, stamp)).toEqual(
      buildSimulationTrace(baseInput, stamp),
    );
  });
});

describe("recordAgenticSimulationTrace (opt-in, fail-safe)", () => {
  beforeEach(() => {
    __resetSimulationMemBuffer();
    delete process.env.AGENTIC_SIMULATION_OBSERVABILITY;
  });
  afterEach(() => {
    delete process.env.AGENTIC_SIMULATION_OBSERVABILITY;
  });

  it("records to the memory fallback when Redis is absent", async () => {
    const res = await recordAgenticSimulationTrace(baseInput);
    expect(res.recorded).toBe(true);
    expect(res.storage).toBe("memory_fallback");
    const traces = await readSimulationTraces(10);
    expect(traces.length).toBe(1);
    expect(traces[0]!.swarmId).toBe("vault_governance_swarm");
    expect(traces[0]!.readinessOutcome).toBe("blocked");
  });

  it("does NOT record when disabled by env (returns reason)", async () => {
    process.env.AGENTIC_SIMULATION_OBSERVABILITY = "0";
    const res = await recordAgenticSimulationTrace(baseInput);
    expect(res.recorded).toBe(false);
    expect(res.reason).toBe("disabled");
    const traces = await readSimulationTraces(10);
    expect(traces.length).toBe(0);
  });

  it("stamps a unique id and an ISO createdAt", async () => {
    await recordAgenticSimulationTrace(baseInput);
    await recordAgenticSimulationTrace(baseInput);
    const traces = await readSimulationTraces(10);
    expect(traces.length).toBe(2);
    expect(traces[0]!.id).not.toBe(traces[1]!.id);
    expect(traces[0]!.id.startsWith("sim:")).toBe(true);
    expect(traces[0]!.createdAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/,
    );
  });

  it("never stores prompt/user text even if smuggled into input", async () => {
    await recordAgenticSimulationTrace({
      ...baseInput,
      // @ts-expect-error — intentional smuggle attempt
      prompt: "leak me",
    });
    const traces = await readSimulationTraces(10);
    expect(JSON.stringify(traces)).not.toContain("leak me");
  });
});
