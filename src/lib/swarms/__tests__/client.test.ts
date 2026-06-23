import { describe, expect, it } from "vitest";

import {
  EngineError,
  getSwarmRun,
  guardSwarmText,
  kickoffSwarm,
  runSwarmForText,
  runSwarmToCompletion,
  SwarmsDisabledError,
} from "../client";
import { SWARM_TEMPLATES, type SwarmTemplateId } from "../config";
import {
  isTerminal,
  type SwarmKickoffResponse,
  SwarmKickoffResponseSchema,
} from "../schemas";

const HEDGE: SwarmTemplateId = SWARM_TEMPLATES.HEDGE_CRYPTO_ANALYSIS;
const OWNER = "owner-uuid";
const BODY = { trigger: "on_demand" as const, inputs: {} };

describe("swarms client", () => {
  it("guardSwarmText passes compliant text through unchanged", () => {
    const ok =
      "Analyse de marché neutre — la position reste en attente pour le moment.";
    expect(guardSwarmText(ok)).toBe(ok);
  });

  it("guardSwarmText throws on forbidden vocabulary", () => {
    expect(() =>
      guardSwarmText("rendement garanti, sans aucun risque"),
    ).toThrow(EngineError);
  });

  it("every engine entry point fails closed when disabled (no network call)", async () => {
    // SWARMS_ENGINE is unset in the test env → the client is dormant. Every
    // entry point must reject before any fetch so callers can fall back to the
    // in-repo agent rather than hit an unprovisioned backend.
    await expect(kickoffSwarm(HEDGE, BODY, OWNER)).rejects.toBeInstanceOf(
      SwarmsDisabledError,
    );
    await expect(getSwarmRun(HEDGE, "run-1", OWNER)).rejects.toBeInstanceOf(
      SwarmsDisabledError,
    );
    await expect(
      runSwarmToCompletion(HEDGE, BODY, OWNER),
    ).rejects.toBeInstanceOf(SwarmsDisabledError);
    await expect(runSwarmForText(HEDGE, BODY, OWNER)).rejects.toBeInstanceOf(
      SwarmsDisabledError,
    );
  });

  it("isTerminal recognises terminal vs running statuses", () => {
    expect(isTerminal("completed")).toBe(true);
    expect(isTerminal("failed")).toBe(true);
    expect(isTerminal("cancelled")).toBe(true);
    expect(isTerminal("running")).toBe(false);
    expect(isTerminal("paused_hitl")).toBe(false);
  });

  it("parses a valid kickoff response and rejects a malformed one", () => {
    const ok: SwarmKickoffResponse = SwarmKickoffResponseSchema.parse({
      run_id: "r1",
      swarm_id: HEDGE,
      status: "running",
    });
    expect(ok.run_id).toBe("r1");
    expect(() => SwarmKickoffResponseSchema.parse({ status: "running" })).toThrow();
  });
});
