import type {
  AdminReadToolId,
  AdminReadToolResult,
} from "@/lib/llm/tools/types";

type ProjectionNode =
  | true
  | { kind: "object"; fields: Record<string, ProjectionNode> }
  | { kind: "array"; item: ProjectionNode };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function projectValue(value: unknown, spec: ProjectionNode): unknown {
  if (spec === true) return value;

  if (spec.kind === "array") {
    if (!Array.isArray(value)) return [];
    return value.map((item) => projectValue(item, spec.item));
  }

  if (!isRecord(value)) return {};
  const output: Record<string, unknown> = {};
  for (const [field, childSpec] of Object.entries(spec.fields)) {
    if (!(field in value)) continue;
    output[field] = projectValue(value[field], childSpec);
  }
  return output;
}

const PROVENANCE_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    source: true,
    timestampIso: true,
    freshness: true,
  },
};

const CHART_POINT_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    x: true,
    btc_price_usd: true,
    hashprice_usd_th_day: true,
    mining_margin_score: true,
    apy_low_pct: true,
    apy_high_pct: true,
    risk_score: true,
  },
};

const CHART_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    title: true,
    intent: true,
    type: true,
    timeframe: true,
    axes: {
      kind: "object",
      fields: {
        x: {
          kind: "object",
          fields: {
            key: true,
            label: true,
          },
        },
        y: {
          kind: "object",
          fields: {
            key: true,
            label: true,
          },
        },
      },
    },
    labels: { kind: "array", item: true },
    series: {
      kind: "object",
      fields: {
        mining: {
          kind: "object",
          fields: {
            available: true,
            points: { kind: "array", item: CHART_POINT_PROJECTION },
          },
        },
        vault: {
          kind: "object",
          fields: {
            available: true,
            points: { kind: "array", item: CHART_POINT_PROJECTION },
          },
        },
      },
    },
    provenance: { kind: "array", item: PROVENANCE_PROJECTION },
    caveats: { kind: "array", item: true },
  },
};

const DEMO_PLAN_STEP_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    order: true,
    route: true,
    talkingPoints: { kind: "array", item: true },
  },
};

const DEMO_PACK_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    metadata: {
      kind: "object",
      fields: {
        generatedAt: true,
        objective: true,
        audience: true,
      },
    },
    demoPlan: { kind: "array", item: DEMO_PLAN_STEP_PROJECTION },
    charts: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          chart: CHART_PROJECTION,
        },
      },
    },
    checklist: { kind: "array", item: true },
    provenanceFreshnessSummary: {
      kind: "object",
      fields: {
        planSource: true,
        chartSource: true,
        chartFreshness: { kind: "array", item: true },
        generatedFrom: { kind: "array", item: true },
      },
    },
  },
};

const BRIEFING_PACK_PROJECTION: ProjectionNode = {
  kind: "object",
  fields: {
    metadata: {
      kind: "object",
      fields: {
        generatedAt: true,
        objective: true,
        audience: true,
        packageType: true,
      },
    },
    executiveSummary: {
      kind: "object",
      fields: {
        context: true,
        highlights: { kind: "array", item: true },
        assumptions: { kind: "array", item: true },
        disclaimer: true,
      },
    },
    demoPlan: { kind: "array", item: DEMO_PLAN_STEP_PROJECTION },
    charts: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          chart: CHART_PROJECTION,
        },
      },
    },
    operationalActionPlan: {
      kind: "array",
      item: {
        kind: "object",
        fields: {
          order: true,
          bullet: true,
        },
      },
    },
    riskNotes: { kind: "array", item: true },
    provenanceFreshnessSummary: {
      kind: "object",
      fields: {
        planSource: true,
        chartSource: true,
        chartFreshness: { kind: "array", item: true },
        generatedFrom: { kind: "array", item: true },
      },
    },
  },
};

const READ_TOOL_PAYLOAD_PROJECTIONS: Partial<Record<AdminReadToolId, ProjectionNode>> = {
  generate_chart_spec: {
    kind: "object",
    fields: {
      chart: CHART_PROJECTION,
    },
  },
  export_demo_pack: DEMO_PACK_PROJECTION,
  export_briefing_pack: BRIEFING_PACK_PROJECTION,
};

export function projectAdminReadResultForExternal(
  result: AdminReadToolResult,
): AdminReadToolResult {
  const projection = READ_TOOL_PAYLOAD_PROJECTIONS[result.id];
  if (!projection || !result.payload) return result;

  const projectedPayload = projectValue(result.payload, projection);
  if (!isRecord(projectedPayload)) {
    return { ...result, payload: undefined };
  }

  return {
    ...result,
    payload: projectedPayload,
  };
}
