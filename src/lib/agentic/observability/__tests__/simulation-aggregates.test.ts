/**
 * Unit tests — pure simulation aggregation. No I/O, no Date read (nowMs injected).
 */

import { describe, it, expect } from "vitest";

import {
  aggregateAgenticSimulationTraces,
  parseSimulationWindow,
} from "../simulation-aggregates";
import type { AgenticSimulationTrace } from "../simulation-trace";

function trace(
  partial: Partial<AgenticSimulationTrace> & { swarmId: string },
): AgenticSimulationTrace {
  return {
    id: `sim:${partial.swarmId}:${partial.createdAt ?? "x"}`,
    createdAt: partial.createdAt ?? "2026-06-26T00:00:00.000Z",
    kind: "agentic_simulation",
    swarmId: partial.swarmId,
    swarmMode: partial.swarmMode ?? "simulation",
    ...(partial.actionId ? { actionId: partial.actionId } : {}),
    ...(partial.readinessOutcome
      ? { readinessOutcome: partial.readinessOutcome }
      : {}),
    blockedCount: partial.blockedCount ?? 0,
    gateCount: partial.gateCount ?? 0,
    confirmationCount: partial.confirmationCount ?? 0,
    auditReasonCodes: partial.auditReasonCodes ?? [],
    sideEffects: false,
    metadataOnly: true,
  };
}

const SAMPLE: AgenticSimulationTrace[] = [
  trace({
    swarmId: "platform_reporting_swarm",
    swarmMode: "simulation",
    blockedCount: 3,
    auditReasonCodes: ["swarm_simulation", "crew_read_only"],
  }),
  trace({
    swarmId: "vault_governance_swarm",
    swarmMode: "dry_run",
    actionId: "deploy_product",
    readinessOutcome: "blocked",
    blockedCount: 5,
    auditReasonCodes: ["swarm_dry_run", "crew_read_only"],
  }),
  trace({
    swarmId: "outreach_governed_swarm",
    swarmMode: "gated",
    actionId: "outreach_trigger_send_run",
    readinessOutcome: "requires_human_confirmation",
    blockedCount: 4,
    gateCount: 1,
    confirmationCount: 1,
    auditReasonCodes: ["swarm_gated", "crew_requires_gate"],
  }),
];

describe("aggregateAgenticSimulationTraces", () => {
  it("rolls up totals", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE);
    expect(agg.totals.simulations).toBe(3);
    expect(agg.totals.blocked).toBe(12);
    expect(agg.totals.gates).toBe(1);
    expect(agg.totals.confirmations).toBe(1);
    expect(agg.totals.recordedWithReadiness).toBe(2);
    expect(agg.metadataOnly).toBe(true);
    expect(agg.window.requested).toBe("all");
    expect(agg.window.traceCount).toBe(3);
  });

  it("groups by swarm with per-swarm counts", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE);
    const vault = agg.bySwarm.find((s) => s.swarmId === "vault_governance_swarm");
    expect(vault).toMatchObject({ count: 1, blockedCount: 5 });
    expect(agg.bySwarm.length).toBe(3);
  });

  it("groups by mode", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE);
    const modes = Object.fromEntries(agg.byMode.map((m) => [m.mode, m.count]));
    expect(modes).toEqual({ simulation: 1, dry_run: 1, gated: 1 });
  });

  it("groups by readiness outcome", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE);
    const outcomes = Object.fromEntries(
      agg.byReadinessOutcome.map((o) => [o.outcome, o.count]),
    );
    expect(outcomes).toEqual({
      blocked: 1,
      requires_human_confirmation: 1,
    });
  });

  it("surfaces top reason codes sorted by count desc", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE);
    const top = agg.topReasonCodes[0]!;
    expect(top.reasonCode).toBe("crew_read_only"); // appears twice
    expect(top.count).toBe(2);
  });

  it("respects topReasonCodesLimit", () => {
    const agg = aggregateAgenticSimulationTraces(SAMPLE, {
      topReasonCodesLimit: 1,
    });
    expect(agg.topReasonCodes.length).toBe(1);
  });

  it("is deterministic for the same input", () => {
    expect(aggregateAgenticSimulationTraces(SAMPLE)).toEqual(
      aggregateAgenticSimulationTraces(SAMPLE),
    );
  });

  it("filters by window using the injected nowMs", () => {
    const now = Date.parse("2026-06-26T12:00:00.000Z");
    const recent = trace({
      swarmId: "platform_reporting_swarm",
      createdAt: "2026-06-26T11:30:00.000Z", // within 1h
    });
    const old = trace({
      swarmId: "platform_reporting_swarm",
      createdAt: "2026-06-25T00:00:00.000Z", // outside 1h
    });
    const agg = aggregateAgenticSimulationTraces([recent, old], {
      window: "1h",
      nowMs: now,
    });
    expect(agg.window.traceCount).toBe(1);
    expect(agg.window.from).toBeDefined();
    expect(agg.window.to).toBeDefined();
  });

  it("emits NO raw payload / prompt even if a trace carries extra fields", () => {
    const dirty = {
      ...trace({ swarmId: "platform_reporting_swarm" }),
      // smuggled forbidden fields:
      prompt: "secret prompt",
      userText: "leak",
      rawContext: { token: "sk-xyz" },
    } as unknown as AgenticSimulationTrace;
    const agg = aggregateAgenticSimulationTraces([dirty]);
    const json = JSON.stringify(agg);
    expect(json).not.toContain("secret prompt");
    expect(json).not.toContain("leak");
    expect(json).not.toContain("sk-xyz");
    // No raw trace bodies are embedded — only group-by metadata.
    expect(json).not.toContain('"id"');
    expect(json).not.toContain("createdAt");
  });

  it("handles an empty trace list safely", () => {
    const agg = aggregateAgenticSimulationTraces([]);
    expect(agg.totals.simulations).toBe(0);
    expect(agg.bySwarm).toEqual([]);
    expect(agg.topReasonCodes).toEqual([]);
  });
});

describe("parseSimulationWindow", () => {
  it("defaults empty/absent to all", () => {
    expect(parseSimulationWindow(null)).toBe("all");
    expect(parseSimulationWindow("")).toBe("all");
    expect(parseSimulationWindow(undefined)).toBe("all");
  });
  it("accepts known windows", () => {
    expect(parseSimulationWindow("1h")).toBe("1h");
    expect(parseSimulationWindow("24h")).toBe("24h");
    expect(parseSimulationWindow("7d")).toBe("7d");
  });
  it("returns undefined for an invalid window", () => {
    expect(parseSimulationWindow("9001y")).toBeUndefined();
  });
});
