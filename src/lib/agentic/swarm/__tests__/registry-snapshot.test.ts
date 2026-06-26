/**
 * Unit tests — pure agentic registry snapshot serializer.
 */

import { describe, expect, it } from "vitest";

import { buildAgenticRegistrySnapshot } from "../registry-snapshot";
import { SWARM_DEFINITIONS } from "../registry";

describe("buildAgenticRegistrySnapshot", () => {
  it("is deterministic", () => {
    expect(buildAgenticRegistrySnapshot()).toEqual(
      buildAgenticRegistrySnapshot(),
    );
  });

  it("includes every swarm with a safe mode", () => {
    const snap = buildAgenticRegistrySnapshot();
    expect(snap.swarms.length).toBe(SWARM_DEFINITIONS.length);
    for (const s of snap.swarms) {
      expect(["simulation", "dry_run", "gated"]).toContain(s.mode);
    }
  });

  it("includes crews, actions, and agents", () => {
    const snap = buildAgenticRegistrySnapshot();
    expect(snap.crews.length).toBeGreaterThan(0);
    expect(snap.actions.length).toBeGreaterThan(0);
    expect(snap.agents.length).toBeGreaterThan(0);
  });

  it("advertises safety metadata that forbids autonomous_write", () => {
    const { safety } = buildAgenticRegistrySnapshot();
    expect(safety.allowedSwarmModes).toEqual(["simulation", "dry_run", "gated"]);
    expect(safety.disallowedSwarmModes).toContain("autonomous_write");
    expect(safety.simulationOnly).toBe(true);
    expect(safety.noExternalTools).toBe(true);
    expect(safety.noDbWrites).toBe(true);
    expect(safety.noPromptOrUserTextStored).toBe(true);
    expect(safety.forbiddenAutonomousActions).toContain("deploy_product");
  });

  it("no action in the snapshot is autonomous-allowed", () => {
    const { actions } = buildAgenticRegistrySnapshot();
    for (const a of actions) {
      if (a.tier === "confirmed_write" || a.tier === "forbidden_autonomous") {
        expect(a.autonomousAllowed).toBe(false);
      }
    }
  });

  it("is JSON-stable with no wall-clock timestamp", () => {
    const json = JSON.stringify(buildAgenticRegistrySnapshot());
    expect(json).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
});
