import { describe, expect, it } from "vitest";

import {
  LIVE_SWARM_STAGES,
  LIVE_SWARM_STAGE_IDS,
  getLiveSwarmStage,
} from "@/lib/agentic/swarm/live/stage-registry";
import {
  assertStageSafe,
  assertAllStagesSafe,
  assertDraftEffectsSuppressed,
} from "@/lib/agentic/swarm/live/assert-live-safe";
import { LIVE_READ_FORBIDDEN_ACTIONS } from "@/lib/agentic/swarm/live/types";

describe("live-read swarm — safety floor", () => {
  it("registers exactly the six pipeline stages in order", () => {
    expect(LIVE_SWARM_STAGE_IDS).toEqual([
      "telegram_pricing",
      "market_live",
      "strategy_cross",
      "quant_montecarlo",
      "charts",
      "writeup",
    ]);
  });

  it("every stage passes the safety floor (mode + capabilities + forbidden set)", () => {
    expect(assertAllStagesSafe(LIVE_SWARM_STAGES)).toEqual([]);
  });

  it("every stage is mode live_read and forbids the full floor", () => {
    for (const stage of LIVE_SWARM_STAGES) {
      expect(stage.mode, stage.id).toBe("live_read");
      for (const floor of LIVE_READ_FORBIDDEN_ACTIONS) {
        expect(stage.forbiddenActions, stage.id).toContain(floor);
      }
    }
  });

  it("the floor forbids deploy, mark-live, send, and custodial transfer", () => {
    expect(LIVE_READ_FORBIDDEN_ACTIONS).toContain("deploy_product");
    expect(LIVE_READ_FORBIDDEN_ACTIONS).toContain("mark_vault_live");
    expect(LIVE_READ_FORBIDDEN_ACTIONS).toContain("outreach_trigger_send_run");
    expect(LIVE_READ_FORBIDDEN_ACTIONS).toContain("custodial_transfer");
  });

  it("rejects a stage with a non-readonly capability", () => {
    const bad = {
      ...LIVE_SWARM_STAGES[0]!,
      capabilities: ["write_vault" as never],
    };
    const v = assertStageSafe(bad);
    expect(v.some((x) => x.kind === "non_readonly_capability")).toBe(true);
  });

  it("rejects a stage missing a floor forbidden action", () => {
    const bad = {
      ...LIVE_SWARM_STAGES[0]!,
      forbiddenActions: ["deploy_product"], // missing the rest of the floor
    };
    const v = assertStageSafe(bad);
    expect(v.some((x) => x.kind === "missing_floor_forbidden")).toBe(true);
  });

  it("a draft with any effect set true is rejected", () => {
    const v = assertDraftEffectsSuppressed({
      effects: {
        externalSend: false,
        deployed: true as never,
        markedLive: false,
        custodialWrite: false,
      },
    });
    expect(v.some((x) => x.kind === "effect_not_suppressed")).toBe(true);
  });

  it("a fully-suppressed draft passes", () => {
    expect(
      assertDraftEffectsSuppressed({
        effects: {
          externalSend: false,
          deployed: false,
          markedLive: false,
          custodialWrite: false,
        },
      }),
    ).toEqual([]);
  });

  it("getLiveSwarmStage resolves a known stage and rejects an unknown one", () => {
    expect(getLiveSwarmStage("charts")?.label).toBe("Charts Swarm");
    expect(getLiveSwarmStage("nope")).toBeUndefined();
  });
});
