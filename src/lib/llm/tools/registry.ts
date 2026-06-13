import "server-only";

import { z } from "zod";
import { prisma } from "@/lib/db";
import {
  VAULT_YIELD,
  VAULT_DEFENSIVE,
  VAULT_BTC_PLUS,
} from "@/lib/engine/vaults";
import { FEATURE_FLAGS } from "@/lib/feature-flags";
import { getProductRoutes } from "@/lib/product-routes";
import { getSpecIndex } from "@/lib/spec";
import { ADMIN_NAV_DESTINATIONS } from "@/lib/llm/navigate-tool";
import {
  classifyProductWorkspaceIntent,
} from "@/lib/llm/product-workspace-intent";
import {
  createWriteConfirmation,
  consumeWriteConfirmation,
  hashCanonicalPayload,
} from "@/lib/llm/tools/confirmations";
import {
  isAdminReadToolAllowed,
  isAdminWriteToolAllowed,
} from "@/lib/llm/tools/policy";
import { logger } from "@/lib/logger";
import type {
  AdminToolDefinition,
  AdminToolTelemetryStatus,
  AdminWriteToolDefinition,
  AdminWriteToolExecutionOptions,
  AdminReadToolDefinition,
  AdminReadToolExecutionOptions,
  AdminReadToolExecutionContext,
  AdminReadToolResult,
  ExecuteAdminWriteToolRequest,
  ExecuteAdminWriteToolResult,
} from "@/lib/llm/tools/types";

const MAX_ROUTES = 20;
const MAX_SPECS = 12;
const DEFAULT_WRITE_CONFIRMATION_TTL_MS = 5 * 60 * 1000;
const DEFAULT_CHART_TIMEFRAME = "30d";
const MAX_TELEMETRY_ERROR_MESSAGE_LEN = 500;
const MAX_TELEMETRY_ERROR_CODE_LEN = 120;
const LIVE_PRICE_STALE_THRESHOLD_MS = 60_000;
const PRODUCT_WORKSPACE_ROUTE = "/admin/product-workspace";
const SCENARIO_LAB_ROUTE = "/admin/scenario-lab";
const COINGECKO_BTC_SIMPLE_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd&include_last_updated_at=true";

const ChartSpecInputSchema = z.object({
  intent: z.string().trim().min(1).max(120),
  chartType: z.enum(["line", "bar", "area", "stacked_bar", "pie"]),
  timeframe: z.string().trim().min(1).max(40).optional(),
});

const DemoPlanInputSchema = z.object({
  objective: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(200),
});

const ExportDemoPackInputSchema = z.object({
  objective: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(200),
  includeCharts: z.boolean().optional().default(true),
  includeChecklist: z.boolean().optional().default(true),
});

const ExportBriefingPackInputSchema = z.object({
  objective: z.string().trim().min(1).max(300),
  audience: z.string().trim().min(1).max(200),
  includeCharts: z.boolean().optional().default(true),
});

const DemoPlanStepSchema = z.object({
  order: z.number().int().positive(),
  route: z.string().trim().min(1),
  talkingPoints: z.array(z.string().trim().min(1)).min(1),
});

const DemoPlanPayloadSchema = z.object({
  objective: z.string(),
  audience: z.string(),
  routesWhitelist: z.array(z.string()),
  steps: z.array(DemoPlanStepSchema),
  caveats: z.array(z.string()),
});

const ChartProvenanceSchema = z.object({
  source: z.string().trim().min(1),
  timestampIso: z.string().trim().min(1),
  freshness: z.enum(["fresh", "stale", "unknown"]),
});

const ChartPayloadSchema = z
  .object({
    chart: z
      .object({
        title: z.string().trim().min(1),
        intent: z.string().trim().min(1),
        type: z.enum(["line", "bar", "area", "stacked_bar", "pie"]),
        timeframe: z.string().trim().min(1),
        provenance: z.array(ChartProvenanceSchema),
      })
      .passthrough(),
  })
  .passthrough();

const ProvenanceFreshnessSummarySchema = z.object({
  planSource: z.string().trim().min(1),
  chartSource: z.string().trim().min(1),
  chartFreshness: z.array(z.string().trim().min(1)),
  generatedFrom: z.array(z.string().trim().min(1)).min(1),
});

const DemoPackPayloadSchema = z.object({
  metadata: z.object({
    generatedAt: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    audience: z.string().trim().min(1),
  }),
  demoPlan: z.array(DemoPlanStepSchema),
  charts: z.array(ChartPayloadSchema),
  checklist: z.array(z.string().trim().min(1)),
  provenanceFreshnessSummary: ProvenanceFreshnessSummarySchema,
});

const BriefingExecutiveSummarySchema = z.object({
  context: z.string().trim().min(1),
  highlights: z.array(z.string().trim().min(1)).min(2),
  assumptions: z.array(z.string().trim().min(1)).min(1),
  disclaimer: z.string().trim().min(1),
});

const BriefingActionItemSchema = z.object({
  order: z.number().int().positive(),
  bullet: z.string().trim().min(1),
});

const BriefingPackPayloadSchema = z.object({
  metadata: z.object({
    generatedAt: z.string().trim().min(1),
    objective: z.string().trim().min(1),
    audience: z.string().trim().min(1),
    packageType: z.literal("executive_briefing"),
  }),
  executiveSummary: BriefingExecutiveSummarySchema,
  demoPlan: z.array(DemoPlanStepSchema),
  charts: z.array(ChartPayloadSchema),
  operationalActionPlan: z.array(BriefingActionItemSchema).min(1),
  riskNotes: z.array(z.string().trim().min(1)).min(1),
  provenanceFreshnessSummary: ProvenanceFreshnessSummarySchema,
});

const ReviewNoteInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(4_000),
  author: z.string().trim().min(1).max(120).optional(),
});

const GovernanceProposalInputSchema = z.object({
  vaultDeploymentId: z.string().trim().min(1).max(120),
  actionType: z.string().trim().min(1).max(80),
  justification: z.string().trim().min(20).max(8_000),
  proposedBy: z.string().trim().min(1).max(120),
  requiredSigners: z.number().int().positive(),
  calldata: z.string().trim().min(1).max(8_000).optional(),
});

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function formatIso(value: Date | null | undefined): string {
  return value ? value.toISOString() : "unknown";
}

function orderDemoRoutesForObjective(
  routes: readonly string[],
  objective: string,
): string[] {
  const uniqueRoutes = Array.from(new Set(routes));
  const classification = classifyProductWorkspaceIntent(objective);

  if (
    classification.shouldOpenProductWorkspace &&
    uniqueRoutes.includes(PRODUCT_WORKSPACE_ROUTE)
  ) {
    const rest = uniqueRoutes.filter((route) => route !== PRODUCT_WORKSPACE_ROUTE);
    if (
      classification.shouldOpenScenarioLab &&
      rest.includes(SCENARIO_LAB_ROUTE)
    ) {
      return [
        PRODUCT_WORKSPACE_ROUTE,
        SCENARIO_LAB_ROUTE,
        ...rest.filter((route) => route !== SCENARIO_LAB_ROUTE),
      ];
    }
    return [PRODUCT_WORKSPACE_ROUTE, ...rest];
  }

  if (classification.shouldOpenScenarioLab) {
    if (!uniqueRoutes.includes(SCENARIO_LAB_ROUTE)) return uniqueRoutes;
    return [
      SCENARIO_LAB_ROUTE,
      ...uniqueRoutes.filter((route) => route !== SCENARIO_LAB_ROUTE),
    ];
  }

  return uniqueRoutes;
}

function classifyAdminToolError(error: unknown): {
  errorType: string;
  errorMessage: string;
} {
  if (!(error instanceof Error)) {
    return {
      errorType: "UnknownError",
      errorMessage: "unknown error",
    };
  }
  const message = error.message;
  if (message.startsWith("admin_write_confirmation_")) {
    return {
      errorType: "confirmation_rejected",
      errorMessage: toSafeTelemetryMessage(message),
    };
  }
  if (message === "admin_write_tool_not_allowed") {
    return {
      errorType: "tool_not_allowed",
      errorMessage: toSafeTelemetryMessage(message),
    };
  }
  if (message.startsWith("invalid_")) {
    return {
      errorType: "input_invalid",
      errorMessage: toSafeTelemetryMessage(message),
    };
  }
  return {
    errorType: toSafeTelemetryCode(error.name || "Error"),
    errorMessage: toSafeTelemetryMessage(message),
  };
}

function toSafeTelemetryCode(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-z0-9_]/gi, "_")
    .replace(/_+/g, "_")
    .toLowerCase()
    .slice(0, MAX_TELEMETRY_ERROR_CODE_LEN);
  return sanitized.length > 0 ? sanitized : "unknown_error";
}

function toSafeTelemetryMessage(value: string): string {
  const sanitized = value
    .trim()
    .replace(/[^a-z0-9 _:\-]/gi, "_")
    .replace(/\s+/g, " ")
    .slice(0, MAX_TELEMETRY_ERROR_MESSAGE_LEN);
  return sanitized.length > 0 ? sanitized : "unknown error";
}

async function persistAdminToolTelemetry(args: {
  toolId: string;
  toolKind: "read" | "write";
  mode: AdminReadToolExecutionContext["chatMode"];
  profile: AdminReadToolExecutionContext["profile"];
  status: AdminToolTelemetryStatus;
  latencyMs: number;
  userId?: string;
  confirmationTokenUsed?: boolean;
  inputHash?: string;
  error?: unknown;
}): Promise<void> {
  const errorData =
    args.error === undefined ? null : classifyAdminToolError(args.error);
  try {
    await prisma.adminToolRun.create({
      data: {
        toolId: args.toolId,
        toolKind: args.toolKind,
        mode: args.mode,
        profile: args.profile,
        status: args.status,
        latencyMs: Math.max(0, Math.round(args.latencyMs)),
        userId: args.userId ?? null,
        confirmationTokenUsed: args.confirmationTokenUsed ?? false,
        inputHash: args.inputHash ?? null,
        errorCode: errorData?.errorType ?? null,
        errorMessage: errorData?.errorMessage ?? null,
      },
    });
  } catch (traceErr) {
    logger.warn(
      "admin tool telemetry persistence failed",
      {
        toolId: args.toolId,
        status: args.status,
      },
      traceErr instanceof Error ? traceErr : undefined,
    );
  }
}

function hashToolInput(input: unknown): string | undefined {
  if (input === undefined) return undefined;
  try {
    return hashCanonicalPayload(input);
  } catch {
    return undefined;
  }
}

function buildChartProvenanceFreshness(
  timestamp: Date | null | undefined,
  source: string,
): { source: string; timestampIso: string; freshness: "fresh" | "stale" | "unknown" } {
  if (!timestamp) {
    return {
      source,
      timestampIso: "unknown",
      freshness: "unknown",
    };
  }
  const ageMs = Date.now() - timestamp.getTime();
  const freshness: "fresh" | "stale" = ageMs <= 24 * 60 * 60 * 1000 ? "fresh" : "stale";
  return {
    source,
    timestampIso: timestamp.toISOString(),
    freshness,
  };
}

type BtcLivePrice = {
  priceUsd: number;
  takenAt: Date;
  freshnessSeconds: number;
  freshness: "fresh" | "stale";
  source: "coingecko";
};

async function fetchBtcLivePriceFromCoinGecko(): Promise<BtcLivePrice> {
  const startedAt = Date.now();
  const response = await fetch(COINGECKO_BTC_SIMPLE_PRICE_URL, {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`coingecko_http_${response.status}`);
  }

  const raw = (await response.json()) as {
    bitcoin?: { usd?: unknown; last_updated_at?: unknown };
  };
  const priceRaw = raw.bitcoin?.usd;
  const updatedAtRaw = raw.bitcoin?.last_updated_at;
  const priceUsd = typeof priceRaw === "number" ? priceRaw : Number.NaN;
  const updatedAtSeconds =
    typeof updatedAtRaw === "number" ? updatedAtRaw : Number.NaN;
  if (!Number.isFinite(priceUsd) || !Number.isFinite(updatedAtSeconds)) {
    throw new Error("coingecko_invalid_payload");
  }

  const takenAt = new Date(updatedAtSeconds * 1000);
  if (Number.isNaN(takenAt.getTime())) {
    throw new Error("coingecko_invalid_timestamp");
  }
  const freshnessSeconds = Math.max(0, Math.floor((startedAt - takenAt.getTime()) / 1000));
  return {
    priceUsd,
    takenAt,
    freshnessSeconds,
    freshness: freshnessSeconds * 1000 <= LIVE_PRICE_STALE_THRESHOLD_MS ? "fresh" : "stale",
    source: "coingecko",
  };
}

async function runGenerateChartSpec(input: unknown): Promise<{
  title: string;
  lines: string[];
  payload: Record<string, unknown>;
}> {
  const parsed = ChartSpecInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_generate_chart_spec_input");
  }
  const params = parsed.data;
  const timeframe = params.timeframe ?? DEFAULT_CHART_TIMEFRAME;

  const [miningRows, vaultRows] = await Promise.all([
    prisma.miningMetric.findMany({
      orderBy: { takenAt: "asc" },
      take: 30,
      select: {
        takenAt: true,
        btcPrice: true,
        hashprice: true,
        miningMarginScore: true,
      },
    }),
    prisma.vaultSnapshot.findMany({
      orderBy: { takenAt: "asc" },
      take: 30,
      select: {
        takenAt: true,
        currentApyLow: true,
        currentApyHigh: true,
        riskScore: true,
        source: true,
      },
    }),
  ]);

  const latestMiningAt = miningRows.at(-1)?.takenAt;
  const latestVaultAt = vaultRows.at(-1)?.takenAt;
  const miningSeries = miningRows.map((row) => ({
    x: row.takenAt.toISOString(),
    btc_price_usd: Number(row.btcPrice),
    hashprice_usd_th_day: Number(row.hashprice),
    mining_margin_score: row.miningMarginScore,
  }));
  const vaultSeries = vaultRows.map((row) => ({
    x: row.takenAt.toISOString(),
    apy_low_pct: Number(row.currentApyLow),
    apy_high_pct: Number(row.currentApyHigh),
    risk_score: row.riskScore,
  }));

  const payload: Record<string, unknown> = {
    chart: {
      title: `${params.intent} (${timeframe})`,
      intent: params.intent,
      type: params.chartType,
      timeframe,
      axes: {
        x: { key: "x", label: "Timestamp (UTC)" },
        y: { key: "value", label: "Metric value" },
      },
      labels: ["mining", "vault"],
      series: {
        mining: {
          available: miningSeries.length > 0,
          points: miningSeries,
        },
        vault: {
          available: vaultSeries.length > 0,
          points: vaultSeries,
        },
      },
      provenance: [
        buildChartProvenanceFreshness(latestMiningAt ?? null, "MiningMetric"),
        buildChartProvenanceFreshness(
          latestVaultAt ?? null,
          vaultRows.at(-1)?.source ?? "VaultSnapshot",
        ),
      ],
      caveats: [
        "Spec is read-only and deterministic from current DB snapshot.",
        miningSeries.length === 0
          ? "MiningMetric unavailable: no rows found."
          : "Mining series sourced from MiningMetric table.",
        vaultSeries.length === 0
          ? "VaultSnapshot unavailable: no rows found."
          : "Vault series sourced from VaultSnapshot table.",
      ],
    },
  };

  return {
    title: "CHART SPEC",
    lines: [
      `- intent: ${params.intent}`,
      `- type: ${params.chartType}`,
      `- timeframe: ${timeframe}`,
      `- mining_points: ${miningSeries.length}`,
      `- vault_points: ${vaultSeries.length}`,
    ],
    payload,
  };
}

async function runGenerateDemoPlan(input: unknown): Promise<{
  title: string;
  lines: string[];
  payload: Record<string, unknown>;
}> {
  const parsed = DemoPlanInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_generate_demo_plan_input");
  }
  const params = parsed.data;
  const [routes, specs] = await Promise.all([getProductRoutes(), getSpecIndex()]);
  const allowedAdminRoutes = new Set(
    ADMIN_NAV_DESTINATIONS.map((destination) => destination.route),
  );
  const availableAdminRoutes = orderDemoRoutesForObjective(
    routes.filter((route) => allowedAdminRoutes.has(route)),
    params.objective,
  );
  const firstSpec = specs[0];

  const orderedSteps = availableAdminRoutes.slice(0, 5).map((route, index) => ({
    order: index + 1,
    route,
    talkingPoints: [
      `Objective alignment: ${params.objective}`,
      `Audience focus: ${params.audience}`,
      `Explain why ${route} matters in the admin workflow.`,
    ],
    references: firstSpec
      ? [
          {
            type: "spec",
            slug: firstSpec.slug,
            title: firstSpec.title,
          },
        ]
      : [],
  }));

  const payload: Record<string, unknown> = {
    objective: params.objective,
    audience: params.audience,
    routesWhitelist: [...allowedAdminRoutes],
    steps: orderedSteps,
    caveats: [
      "Plan is read-only and uses current route/spec indexes.",
      orderedSteps.length === 0
        ? "No whitelisted admin routes found in current index."
        : "Route targets constrained to current admin navigation whitelist.",
      specs.length === 0
        ? "Spec index unavailable: no docs/spec entries found."
        : "Spec references use current docs/spec index snapshot.",
    ],
  };

  return {
    title: "DEMO PLAN",
    lines: [
      `- objective: ${params.objective}`,
      `- audience: ${params.audience}`,
      `- steps: ${orderedSteps.length}`,
    ],
    payload,
  };
}

async function buildDemoPackData(input: unknown): Promise<{
  params: z.infer<typeof ExportDemoPackInputSchema>;
  metadata: { generatedAt: string; objective: string; audience: string };
  demoPlan: z.infer<typeof DemoPlanStepSchema>[];
  charts: z.infer<typeof ChartPayloadSchema>[];
  checklist: string[];
  provenanceFreshnessSummary: z.infer<typeof ProvenanceFreshnessSummarySchema>;
}> {
  const parsed = ExportDemoPackInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_export_demo_pack_input");
  }
  const params = parsed.data;

  const demoPlanResult = await runGenerateDemoPlan({
    objective: params.objective,
    audience: params.audience,
  });
  const planParsed = DemoPlanPayloadSchema.safeParse(demoPlanResult.payload);
  if (!planParsed.success) {
    throw new Error("invalid_generate_demo_plan_output");
  }

  const chartResults = params.includeCharts
    ? await Promise.all([
        runGenerateChartSpec({
          intent: `Demo narrative support for ${params.objective}`,
          chartType: "line",
          timeframe: DEFAULT_CHART_TIMEFRAME,
        }),
        runGenerateChartSpec({
          intent: `Risk and APY framing for ${params.audience}`,
          chartType: "area",
          timeframe: DEFAULT_CHART_TIMEFRAME,
        }),
      ])
    : [];

  const charts = chartResults.map((entry) => {
    const chartParsed = ChartPayloadSchema.safeParse(entry.payload);
    if (!chartParsed.success) {
      throw new Error("invalid_generate_chart_spec_output");
    }
    return chartParsed.data;
  });

  const checklist = params.includeChecklist
    ? [
        "Validate route access for all demo steps.",
        "Prepare opening statement aligned to objective.",
        "Confirm APY is communicated strictly as a range.",
        "Highlight provenance/freshness before chart discussion.",
        "Close with next action and human approval requirement.",
      ]
    : [];

  const chartProvenance = charts
    .flatMap((entry) => entry.chart.provenance)
    .map((item) => `${item.source}:${item.freshness}`);
  const uniqueChartProvenance = [...new Set(chartProvenance)];

  return {
    params,
    metadata: {
      generatedAt: new Date().toISOString(),
      objective: params.objective,
      audience: params.audience,
    },
    demoPlan: planParsed.data.steps,
    charts,
    checklist,
    provenanceFreshnessSummary: {
      planSource: "generate_demo_plan",
      chartSource: params.includeCharts ? "generate_chart_spec" : "not_included",
      chartFreshness: uniqueChartProvenance,
      generatedFrom: ["routes_index", "spec_index", "MiningMetric", "VaultSnapshot"],
    },
  };
}

async function runExportDemoPack(input: unknown): Promise<{
  title: string;
  lines: string[];
  payload: Record<string, unknown>;
}> {
  const pack = await buildDemoPackData(input);
  const payload = DemoPackPayloadSchema.parse({
    metadata: pack.metadata,
    demoPlan: pack.demoPlan,
    charts: pack.charts,
    checklist: pack.checklist,
    provenanceFreshnessSummary: pack.provenanceFreshnessSummary,
  });

  return {
    title: "DEMO PACK",
    lines: [
      `- objective: ${pack.params.objective}`,
      `- audience: ${pack.params.audience}`,
      `- plan_steps: ${pack.demoPlan.length}`,
      `- charts: ${pack.params.includeCharts ? pack.charts.length : 0}`,
      `- checklist: ${pack.params.includeChecklist ? pack.checklist.length : 0}`,
    ],
    payload,
  };
}

async function runExportBriefingPack(input: unknown): Promise<{
  title: string;
  lines: string[];
  payload: Record<string, unknown>;
}> {
  const parsed = ExportBriefingPackInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_export_briefing_pack_input");
  }

  const demoPack = await buildDemoPackData({
    objective: parsed.data.objective,
    audience: parsed.data.audience,
    includeCharts: parsed.data.includeCharts,
    includeChecklist: false,
  });

  const firstStepRoute = demoPack.demoPlan[0]?.route ?? "n/a";
  const latestFreshness = demoPack.provenanceFreshnessSummary.chartFreshness;
  const riskNotes = [
    "All outputs are read-only and require human approval for any operational follow-up.",
    latestFreshness.some((item) => item.endsWith(":stale"))
      ? "At least one data source is stale; re-validate before external distribution."
      : "No stale chart source detected in this snapshot.",
    "APY communication must remain a range with explicit non-guaranteed framing.",
  ];

  const payload = BriefingPackPayloadSchema.parse({
    metadata: {
      ...demoPack.metadata,
      packageType: "executive_briefing",
    },
    executiveSummary: {
      context: `Prepared for ${parsed.data.audience} with objective "${parsed.data.objective}".`,
      highlights: [
        `Demo plan includes ${demoPack.demoPlan.length} ordered admin route(s).`,
        `First route anchor: ${firstStepRoute}.`,
        parsed.data.includeCharts
          ? `Chart appendix includes ${demoPack.charts.length} deterministic specification(s).`
          : "Chart appendix omitted by request.",
      ],
      assumptions: [
        "Current package reflects point-in-time indexed routes/specs and latest DB snapshots.",
        "Presentation remains constrained to admin read-only capabilities.",
      ],
      disclaimer: "This briefing is informational only and does not guarantee outcomes.",
    },
    demoPlan: demoPack.demoPlan,
    charts: demoPack.charts,
    operationalActionPlan: [
      { order: 1, bullet: "Validate data freshness and route accessibility before the meeting." },
      { order: 2, bullet: "Deliver narrative in PTAI structure for each proposed action." },
      { order: 3, bullet: "Capture executive decisions as explicit human-approved next steps." },
    ],
    riskNotes,
    provenanceFreshnessSummary: demoPack.provenanceFreshnessSummary,
  });

  return {
    title: "BRIEFING PACK",
    lines: [
      `- objective: ${parsed.data.objective}`,
      `- audience: ${parsed.data.audience}`,
      `- plan_steps: ${demoPack.demoPlan.length}`,
      `- charts: ${parsed.data.includeCharts ? demoPack.charts.length : 0}`,
      `- action_items: ${payload.operationalActionPlan.length}`,
      `- risk_notes: ${payload.riskNotes.length}`,
    ],
    payload,
  };
}

export const ADMIN_READ_TOOLS: readonly AdminReadToolDefinition[] = [
  {
    id: "read_allocations_canonical",
    kind: "read",
    description: "Canonical allocations for all vaults",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => {
      const rows = [
        { key: "HYV", vault: VAULT_YIELD },
        { key: "HDV", vault: VAULT_DEFENSIVE },
        { key: "HBP", vault: VAULT_BTC_PLUS },
      ].map(({ key, vault }) => {
        const a = vault.allocationTargets;
        return `- ${key}: mining ${a.mining}%, btc_tactical ${a.btc_tactical}%, usdc_base ${a.usdc_base}%, stable_reserve ${a.stable_reserve}%`;
      });
      return { title: "ALLOCATIONS CANONIQUES", lines: rows };
    },
  },
  {
    id: "read_market_snapshot",
    kind: "read",
    description: "Latest mining and vault snapshots",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => {
      const [latestMiningMetric, latestVaultSnapshot, btcLive] = await Promise.all([
        prisma.miningMetric.findFirst({
          orderBy: { takenAt: "desc" },
          select: {
            takenAt: true,
            btcPrice: true,
            hashprice: true,
            difficulty: true,
            energyCost: true,
            uptimePct: true,
            miningMarginScore: true,
          },
        }),
        prisma.vaultSnapshot.findFirst({
          orderBy: { takenAt: "desc" },
          select: {
            takenAt: true,
            aumUsdc: true,
            currentApyLow: true,
            currentApyHigh: true,
            stressedApy: true,
            riskScore: true,
            miningMarginScore: true,
            mode: true,
            source: true,
          },
        }),
        fetchBtcLivePriceFromCoinGecko().catch(() => null),
      ]);

      const miningLines = latestMiningMetric
        ? [
            "- MARCHE BTC / MINING (latest)",
            `  - taken_at: ${formatIso(latestMiningMetric.takenAt)}`,
            `  - btc_price_usd: ${latestMiningMetric.btcPrice.toString()}`,
            `  - btc_price_usd_exact_live: ${btcLive ? btcLive.priceUsd.toFixed(2) : "unavailable"}`,
            `  - btc_price_live_source: ${btcLive?.source ?? "unavailable"}`,
            `  - btc_price_live_taken_at: ${btcLive ? btcLive.takenAt.toISOString() : "unavailable"}`,
            `  - btc_price_live_freshness_seconds: ${btcLive ? String(btcLive.freshnessSeconds) : "unavailable"}`,
            `  - btc_price_live_freshness: ${btcLive?.freshness ?? "unknown"}`,
            `  - hashprice_usd_th_day: ${latestMiningMetric.hashprice.toString()}`,
            `  - difficulty: ${latestMiningMetric.difficulty.toString()}`,
            `  - energy_cost_usd_kwh: ${latestMiningMetric.energyCost.toString()}`,
            `  - uptime_pct: ${latestMiningMetric.uptimePct.toString()}`,
            `  - mining_margin_score: ${latestMiningMetric.miningMarginScore}`,
          ]
        : [
            "- MARCHE BTC / MINING (latest)",
            "  - unavailable: no MiningMetric row",
          ];

      const snapshotLines = latestVaultSnapshot
        ? [
            "- VAULT SNAPSHOT (latest)",
            `  - taken_at: ${formatIso(latestVaultSnapshot.takenAt)}`,
            `  - aum_usdc: ${latestVaultSnapshot.aumUsdc.toString()}`,
            `  - apy_target_range: ${formatPercent(Number(latestVaultSnapshot.currentApyLow))} to ${formatPercent(Number(latestVaultSnapshot.currentApyHigh))}`,
            `  - stressed_apy_pct: ${formatPercent(Number(latestVaultSnapshot.stressedApy))}`,
            `  - risk_score: ${latestVaultSnapshot.riskScore}`,
            `  - mining_margin_score: ${latestVaultSnapshot.miningMarginScore}`,
            `  - mode: ${latestVaultSnapshot.mode}`,
            `  - source: ${latestVaultSnapshot.source}`,
          ]
        : [
            "- VAULT SNAPSHOT (latest)",
            "  - unavailable: no VaultSnapshot row",
          ];

      return {
        title: "MARKET SNAPSHOT",
        lines: [...miningLines, ...snapshotLines],
      };
    },
  },
  {
    id: "read_routes_index",
    kind: "read",
    description: "Product routes index sample",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => {
      const routes = await getProductRoutes();
      const lines = routes.slice(0, MAX_ROUTES).map((route) => `- ${route}`);
      return {
        title: "ROUTES INDEX (sample)",
        lines: lines.length > 0 ? lines : ["- unavailable: no routes indexed"],
      };
    },
  },
  {
    id: "read_specs_index",
    kind: "read",
    description: "Spec documents index sample",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => {
      const specs = await getSpecIndex();
      const lines = specs
        .slice(0, MAX_SPECS)
        .map((s) => `- ${String(s.order).padStart(2, "0")} · ${s.slug} · ${s.title}`);
      return {
        title: "SPEC INDEX (sample)",
        lines: lines.length > 0 ? lines : ["- unavailable: no specs indexed"],
      };
    },
  },
  {
    id: "read_runtime_capabilities",
    kind: "read",
    description: "Runtime capabilities matrix",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "multiline_text_block",
    parameters: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    run: async () => ({
      title: "CAPACITES OUTILLEES (RUNTIME APP)",
      lines: [
        `- navigation_outillee: ${FEATURE_FLAGS.CHAT_MASTER_AGENT ? "yes" : "no"} (navigate whitelist seulement)`,
        "- internet_live_outille: yes (coingecko btc price live)",
        "- deploy_execute_outille: no",
        "- db_write_outille: no",
        "- fireblocks_sign_outille: no",
        "- chart_renderer_outille: no",
        "- demo_runner_outille: no",
      ],
    }),
  },
  {
    id: "generate_chart_spec",
    kind: "read",
    description: "Generate deterministic chart specification from available data",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "json_object",
    parameters: {
      type: "object",
      properties: {
        intent: { type: "string" },
        chartType: {
          type: "string",
          enum: ["line", "bar", "area", "stacked_bar", "pie"],
        },
        timeframe: { type: "string" },
      },
      required: ["intent", "chartType"],
      additionalProperties: false,
    },
    run: async (_context, input) => runGenerateChartSpec(input),
  },
  {
    id: "generate_demo_plan",
    kind: "read",
    description: "Generate ordered admin demo plan from indexed routes/specs",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "json_object",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
        audience: { type: "string" },
      },
      required: ["objective", "audience"],
      additionalProperties: false,
    },
    run: async (_context, input) => runGenerateDemoPlan(input),
  },
  {
    id: "export_demo_pack",
    kind: "read",
    description:
      "Export structured demo pack (plan, chart specs, checklist, provenance summary)",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "json_object",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
        audience: { type: "string" },
        includeCharts: { type: "boolean" },
        includeChecklist: { type: "boolean" },
      },
      required: ["objective", "audience"],
      additionalProperties: false,
    },
    run: async (_context, input) => runExportDemoPack(input),
  },
  {
    id: "export_briefing_pack",
    kind: "read",
    description:
      "Export executive-ready briefing package (summary, plan, charts, risks, actions, provenance)",
    riskLevel: "low",
    confirmationRequired: false,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    resultFormat: "json_object",
    parameters: {
      type: "object",
      properties: {
        objective: { type: "string" },
        audience: { type: "string" },
        includeCharts: { type: "boolean" },
      },
      required: ["objective", "audience"],
      additionalProperties: false,
    },
    run: async (_context, input) => runExportBriefingPack(input),
  },
] as const;

export const ADMIN_WRITE_TOOLS: readonly AdminWriteToolDefinition[] = [
  {
    id: "create_review_note_draft",
    kind: "write",
    description: "Create admin review note draft",
    riskLevel: "medium",
    confirmationRequired: true,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    run: async (_context, input) => {
      const payload = parseReviewNoteInput(input);
      const row = await prisma.feedback.create({
        data: {
          message: `[DRAFT][AI_REVIEW_NOTE]\nTitle: ${payload.title}\n${payload.body}`,
          author: payload.author,
          pathname: "/admin",
          resolved: false,
        },
        select: { id: true },
      });
      return {
        title: "REVIEW NOTE DRAFT CREATED",
        lines: [
          `- id: ${row.id}`,
          `- title: ${payload.title}`,
          `- author: ${payload.author ?? "unknown"}`,
          "- persisted_as: Feedback draft row",
        ],
        createdEntityId: row.id,
      };
    },
  },
  {
    id: "create_governance_proposal_draft",
    kind: "write",
    description: "Create governance proposal draft only",
    riskLevel: "high",
    confirmationRequired: true,
    allowedChatModes: ["admin"],
    allowedProfiles: ["admin"],
    run: async (_context, input) => {
      const payload = parseGovernanceProposalInput(input);
      const row = await prisma.governanceProposal.create({
        data: {
          vaultDeploymentId: payload.vaultDeploymentId,
          actionType: payload.actionType,
          calldata: payload.calldata ?? null,
          justification: payload.justification,
          proposedBy: payload.proposedBy,
          requiredSigners: payload.requiredSigners,
          state: "DRAFT",
        },
        select: { id: true, state: true },
      });
      return {
        title: "GOVERNANCE PROPOSAL DRAFT CREATED",
        lines: [
          `- id: ${row.id}`,
          `- state: ${row.state}`,
          `- action_type: ${payload.actionType}`,
          `- vault_deployment_id: ${payload.vaultDeploymentId}`,
          "- execution: not performed (draft only)",
        ],
        createdEntityId: row.id,
      };
    },
  },
] as const;

export const ADMIN_TOOLS: readonly AdminToolDefinition[] = [
  ...ADMIN_READ_TOOLS,
  ...ADMIN_WRITE_TOOLS,
] as const;

function parseReviewNoteInput(input: unknown): {
  title: string;
  body: string;
  author?: string;
} {
  const parsed = ReviewNoteInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_create_review_note_draft_input");
  }
  return parsed.data;
}

function parseGovernanceProposalInput(input: unknown): {
  vaultDeploymentId: string;
  actionType: string;
  justification: string;
  proposedBy: string;
  requiredSigners: number;
  calldata?: string;
} {
  const parsed = GovernanceProposalInputSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("invalid_create_governance_proposal_draft_input");
  }
  return parsed.data;
}

export function getAllowedAdminReadTools(
  context: AdminReadToolExecutionContext,
): AdminReadToolDefinition[] {
  return ADMIN_READ_TOOLS.filter((tool) => isAdminReadToolAllowed(tool, context));
}

export function getAllowedAdminWriteTools(
  context: AdminReadToolExecutionContext,
): AdminWriteToolDefinition[] {
  return ADMIN_WRITE_TOOLS.filter((tool) => isAdminWriteToolAllowed(tool, context));
}

export async function executeAdminReadTool(
  tool: AdminReadToolDefinition,
  context: AdminReadToolExecutionContext,
  input?: unknown,
  options?: AdminReadToolExecutionOptions,
): Promise<AdminReadToolResult> {
  const startedAt = performance.now();
  try {
    const result = await tool.run(context, input);
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "read",
      mode: context.chatMode,
      profile: context.profile,
      status: "success",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(input),
    });
    return {
      id: tool.id,
      format: tool.resultFormat,
      title: result.title,
      lines: result.lines,
      payload: result.payload,
    };
  } catch (error) {
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "read",
      mode: context.chatMode,
      profile: context.profile,
      status: "failed",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(input),
      error,
    });
    throw error;
  }
}

export async function executeAdminWriteTool(
  tool: AdminWriteToolDefinition,
  context: AdminReadToolExecutionContext,
  request: ExecuteAdminWriteToolRequest,
  options?: AdminWriteToolExecutionOptions,
): Promise<ExecuteAdminWriteToolResult> {
  const startedAt = performance.now();
  if (!isAdminWriteToolAllowed(tool, context)) {
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "write",
      mode: context.chatMode,
      profile: context.profile,
      status: "blocked",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(request.input),
      confirmationTokenUsed: Boolean(request.confirmedToken),
      error: new Error("admin_write_tool_not_allowed"),
    });
    throw new Error("admin_write_tool_not_allowed");
  }

  const nowMs = options?.nowMs ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEFAULT_WRITE_CONFIRMATION_TTL_MS;

  if (!request.confirmedToken) {
    const confirmation = await createWriteConfirmation({
      userId: options?.userId ?? "unknown",
      toolId: tool.id,
      input: request.input,
      ttlMs,
      nowMs,
    });
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "write",
      mode: context.chatMode,
      profile: context.profile,
      status: "confirmation_required",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(request.input),
      confirmationTokenUsed: false,
    });
    return {
      status: "confirmation_required",
      toolId: tool.id,
      confirmation: {
        token: confirmation.token,
        expiresAtIso: new Date(confirmation.expiresAtMs).toISOString(),
        summary: `${tool.id} requires explicit confirmation`,
      },
    };
  }

  const consume = await consumeWriteConfirmation({
    userId: options?.userId ?? "unknown",
    token: request.confirmedToken,
    toolId: tool.id,
    input: request.input,
    nowMs,
  });
  if (!consume.ok) {
    logger.warn("admin write confirmation rejected", {
      toolId: tool.id,
      reason: consume.reason,
    });
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "write",
      mode: context.chatMode,
      profile: context.profile,
      status: "blocked",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(request.input),
      confirmationTokenUsed: true,
      error: new Error(`admin_write_confirmation_${consume.reason}`),
    });
    throw new Error(`admin_write_confirmation_${consume.reason}`);
  }

  try {
    const result = await tool.run(context, request.input);
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "write",
      mode: context.chatMode,
      profile: context.profile,
      status: "success",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(request.input),
      confirmationTokenUsed: true,
    });
    return {
      status: "executed",
      toolId: tool.id,
      result,
    };
  } catch (error) {
    logger.error(
      "admin write tool execution failed",
      { toolId: tool.id },
      error instanceof Error ? error : undefined,
    );
    await persistAdminToolTelemetry({
      toolId: tool.id,
      toolKind: "write",
      mode: context.chatMode,
      profile: context.profile,
      status: "failed",
      latencyMs: performance.now() - startedAt,
      userId: options?.userId ?? undefined,
      inputHash: hashToolInput(request.input),
      confirmationTokenUsed: true,
      error,
    });
    throw error;
  }
}
