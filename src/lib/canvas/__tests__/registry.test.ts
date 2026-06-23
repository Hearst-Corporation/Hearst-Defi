/**
 * Canvas registry — the FOURTH structural gate. Two invariants are load-bearing:
 *  - every declared write tool is a REAL AdminWriteToolId (so the chat-tools
 *    route can never be asked to run a tool that doesn't exist);
 *  - no LP (read-only) canvas declares ANY write tool (an LP canvas can never
 *    surface a mutation button).
 */

import { describe, expect, it } from "vitest";

import { CANVAS_DEFINITIONS, canvasAllowsWriteTool, isAdminCanvas } from "@/lib/canvas/registry";
import { CANVAS_IDS } from "@/lib/canvas/contract";
import { ADMIN_WRITE_TOOL_IDS } from "@/lib/llm/tools/types";

const WRITE_IDS = new Set<string>(ADMIN_WRITE_TOOL_IDS);

describe("canvas registry", () => {
  it("declares a definition for every CanvasId (and no extras)", () => {
    expect(Object.keys(CANVAS_DEFINITIONS).sort()).toEqual([...CANVAS_IDS].sort());
  });

  it("every write-tool in any allowlist is a real AdminWriteToolId", () => {
    for (const def of Object.values(CANVAS_DEFINITIONS)) {
      for (const toolId of def.writeToolAllowlist) {
        expect(WRITE_IDS.has(toolId)).toBe(true);
      }
    }
  });

  it("NO lp-audience canvas declares any write tool", () => {
    for (const def of Object.values(CANVAS_DEFINITIONS)) {
      if (def.audience === "lp") {
        expect(def.writeToolAllowlist).toHaveLength(0);
      }
    }
  });

  it("create-vault may propose create_vault_draft, nothing destructive", () => {
    expect(canvasAllowsWriteTool("create-vault", "create_vault_draft")).toBe(true);
    // markAsLive is not a tool at all — it can't even be referenced here.
    expect(canvasAllowsWriteTool("create-vault", "outreach_trigger_send_run")).toBe(false);
  });

  it("the LP yield explainer allows zero writes", () => {
    expect(isAdminCanvas("lp-yield-explainer")).toBe(false);
    expect(canvasAllowsWriteTool("lp-yield-explainer", "create_vault_draft")).toBe(false);
  });
});
