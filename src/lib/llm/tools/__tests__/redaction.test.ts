/**
 * Unit tests for projectAdminReadResultForExternal — the allowlist projection
 * that strips any field not explicitly whitelisted before a read-tool payload
 * leaves the server for the model/client. This is the redaction boundary; the
 * route test exercises it end-to-end, this pins the projection contract directly.
 */
import { describe, it, expect } from "vitest";

import { projectAdminReadResultForExternal } from "@/lib/llm/tools/redaction";
import type { AdminReadToolResult } from "@/lib/llm/tools/types";

function base(
  id: AdminReadToolResult["id"],
  payload: Record<string, unknown>,
): AdminReadToolResult {
  return { id, title: "T", lines: [], format: "json_object", payload };
}

/** Narrow an `unknown` projected-payload field to a plain object for dotted-property assertions. */
function obj(value: unknown): Record<string, unknown> {
  return value as Record<string, unknown>;
}

/** Narrow an `unknown` projected-payload field to an array for indexed assertions. */
function arr(value: unknown): unknown[] {
  return value as unknown[];
}

describe("projectAdminReadResultForExternal", () => {
  it("returns the result untouched when the tool has no projection / no payload", () => {
    const r = base("read_market_snapshot", { anything: 1, secret: "x" });
    // read_market_snapshot has no projection entry → passthrough.
    expect(projectAdminReadResultForExternal(r)).toBe(r);

    const noPayload: AdminReadToolResult = {
      id: "export_demo_pack",
      title: "T",
      lines: [],
      format: "json_object",
    };
    expect(projectAdminReadResultForExternal(noPayload)).toBe(noPayload);
  });

  it("drops non-allowlisted top-level + nested fields for export_demo_pack", () => {
    const r = base("export_demo_pack", {
      metadata: {
        generatedAt: "2026-06-23",
        objective: "Investor demo",
        audience: "LP",
        internalOnly: "leak-me", // not allowlisted
      },
      demoPlan: [
        { order: 1, route: "/admin", talkingPoints: ["a"], references: ["secret-ref"] },
      ],
      checklist: ["x"],
      provenanceFreshnessSummary: {
        planSource: "doc",
        chartSource: "db",
        chartFreshness: ["fresh"],
        generatedFrom: ["snapshot"],
        privateSourceIds: ["id-1"], // not allowlisted
      },
      secretToken: "do-not-leak", // not allowlisted top-level
    });

    const out = projectAdminReadResultForExternal(r);
    const p = obj(out.payload);
    const demoPlan0 = obj(arr(p.demoPlan)[0]);

    // allowlisted fields survive
    expect(obj(p.metadata).objective).toBe("Investor demo");
    expect(demoPlan0.order).toBe(1);
    expect(demoPlan0.talkingPoints).toEqual(["a"]);
    expect(p.checklist).toEqual(["x"]);
    expect(obj(p.provenanceFreshnessSummary).planSource).toBe("doc");

    // non-allowlisted fields are stripped at every level
    expect(p.metadata).not.toHaveProperty("internalOnly");
    expect(demoPlan0).not.toHaveProperty("references");
    expect(p.provenanceFreshnessSummary).not.toHaveProperty("privateSourceIds");
    expect(p).not.toHaveProperty("secretToken");
  });

  it("projects a chart payload to its whitelisted chart fields only", () => {
    const r = base("generate_chart_spec", {
      chart: {
        title: "APY",
        intent: "show",
        type: "line",
        timeframe: "30d",
        provenance: [{ source: "db", timestampIso: "2026-06-23T00:00:00Z", freshness: "fresh", hidden: "x" }],
        rawQuery: "SELECT * FROM secret", // not allowlisted
      },
      sideChannel: "leak", // not allowlisted top-level
    });

    const out = projectAdminReadResultForExternal(r);
    const p = obj(out.payload);
    const chart = obj(p.chart);
    const provenance0 = obj(arr(chart.provenance)[0]);

    expect(chart.title).toBe("APY");
    expect(provenance0.source).toBe("db");
    expect(provenance0).not.toHaveProperty("hidden");
    expect(chart).not.toHaveProperty("rawQuery");
    expect(p).not.toHaveProperty("sideChannel");
  });
});
