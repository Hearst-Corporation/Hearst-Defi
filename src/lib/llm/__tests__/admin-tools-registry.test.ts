import { beforeEach, describe, expect, it, vi } from "vitest";

import { isAdminReadToolAllowed } from "@/lib/llm/tools/policy";
import { clearWriteConfirmationsForTests } from "@/lib/llm/tools/confirmations";
import {
  ADMIN_READ_TOOLS,
  ADMIN_WRITE_TOOLS,
  executeAdminReadTool,
  executeAdminWriteTool,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
} from "@/lib/llm/tools/registry";
import type {
  AdminReadToolDefinition,
  AdminWriteToolDefinition,
} from "@/lib/llm/tools/types";

import { prisma } from "@/lib/db";

type ConfirmationRow = {
  token: string;
  userId: string;
  toolId: string;
  payloadHash: string;
  expiresAt: Date;
  usedAt: Date | null;
};

type MockWithImplementation<TResult> = {
  mockImplementation(fn: (args?: unknown) => Promise<TResult>): void;
};

vi.mock("@/lib/db", () => ({
  prisma: {
    adminWriteToolConfirmation: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    feedback: { create: vi.fn() },
    governanceProposal: { create: vi.fn() },
    adminToolRun: { create: vi.fn() },
    miningMetric: { findMany: vi.fn(), findFirst: vi.fn() },
    vaultSnapshot: { findMany: vi.fn(), findFirst: vi.fn() },
    outreachICP: { findFirst: vi.fn() },
  },
}));

// Outreach write tools delegate to these real-effect modules. Mock them so the
// dispatch tests exercise the confirmation + execution flow WITHOUT sourcing,
// drafting, or sending anything for real (no Apollo, no Resend, no DB writes).
const mockRunSourcing = vi.fn();
const mockDraftEmailForProspect = vi.fn();
const mockOutreachAutoSendHandler = vi.fn();

vi.mock("@/app/admin/outreach/actions", () => ({
  runSourcing: (...args: unknown[]) => mockRunSourcing(...args),
  draftEmailForProspect: (...args: unknown[]) => mockDraftEmailForProspect(...args),
}));
vi.mock("@/lib/inngest/functions/outreach-auto-send", () => ({
  outreachAutoSendHandler: (...args: unknown[]) => mockOutreachAutoSendHandler(...args),
}));

const mockAdminWriteConfirmationCreate = prisma.adminWriteToolConfirmation
  .create as unknown as MockWithImplementation<ConfirmationRow>;
const mockAdminWriteConfirmationFindUnique = prisma.adminWriteToolConfirmation
  .findUnique as unknown as MockWithImplementation<ConfirmationRow | null>;
const mockAdminWriteConfirmationUpdateMany = prisma.adminWriteToolConfirmation
  .updateMany as unknown as MockWithImplementation<{ count: number }>;
const mockAdminWriteConfirmationDeleteMany = prisma.adminWriteToolConfirmation
  .deleteMany as unknown as MockWithImplementation<{ count: number }>;
const mockFeedbackCreate = vi.mocked(prisma.feedback.create);
const mockGovernanceCreate = vi.mocked(prisma.governanceProposal.create);
const mockAdminToolRunCreate = vi.mocked(prisma.adminToolRun.create);
const mockMiningFindMany = vi.mocked(prisma.miningMetric.findMany);
const mockVaultFindMany = vi.mocked(prisma.vaultSnapshot.findMany);
const mockMiningFindFirst = vi.mocked(prisma.miningMetric.findFirst);
const mockVaultFindFirst = vi.mocked(prisma.vaultSnapshot.findFirst);
const mockFetch = vi.fn();

const tokenStore = new Map<string, ConfirmationRow>();
const EMPTY_OBJECT_INPUT_HASH =
  "44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";
const REVIEW_NOTE_HASH_WITH_AUTHOR =
  "d465652e0ce623b34bfcb34edfafd737df0d287b903a1e8ef4a0d9190abed36c";

type AdminToolRunTelemetryRow = {
  toolId: string;
  toolKind: "read" | "write";
  mode: "admin" | "review" | "normal";
  profile: "admin" | "lp";
  status: "success" | "failed" | "blocked" | "confirmation_required";
  latencyMs: number;
  userId: string | null;
  confirmationTokenUsed: boolean;
  inputHash: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

function getTelemetryRows(): AdminToolRunTelemetryRow[] {
  return mockAdminToolRunCreate.mock.calls.map((args) => {
    const callArg = args[0] as { data: AdminToolRunTelemetryRow };
    return callArg.data;
  });
}

function setupConfirmationMocks(): void {
  mockAdminWriteConfirmationCreate.mockImplementation(async (args: unknown) => {
    const data = (args as { data: {
      token: string;
      userId: string;
      toolId: string;
      payloadHash: string;
      expiresAt: Date;
      usedAt: Date | null;
    } }).data;
    tokenStore.set(data.token, { ...data });
    return data as never;
  });
  mockAdminWriteConfirmationFindUnique.mockImplementation(async (args: unknown) => {
    const token = (args as { where: { token: string } }).where.token;
    const row = tokenStore.get(token);
    return (row ? { ...row } : null) as never;
  });
  mockAdminWriteConfirmationUpdateMany.mockImplementation(async (args: unknown) => {
    const typed = args as {
      where?: { token?: string | { equals?: string } };
      data: { usedAt: Date };
    };
    const token = typeof typed.where?.token === "string"
      ? typed.where.token
      : typed.where?.token?.equals;
    if (!token) return { count: 0 };
    const row = tokenStore.get(token);
    if (!row || row.usedAt !== null) {
      return { count: 0 } as never;
    }
    row.usedAt = typed.data.usedAt;
    tokenStore.set(token, row);
    return { count: 1 } as never;
  });
  mockAdminWriteConfirmationDeleteMany.mockImplementation(async (args: unknown) => {
    const typed = args as
      | {
          where?: {
            OR?: Array<{
              expiresAt?: { lt: Date };
              usedAt?: { not: null };
            }>;
          };
        }
      | undefined;
    let count = 0;
    for (const [token, row] of tokenStore.entries()) {
      const shouldDeleteAll = !typed?.where;
      const shouldDeleteExpired = typed?.where?.OR?.some((condition) =>
        condition.expiresAt ? row.expiresAt < condition.expiresAt.lt : false,
      );
      const shouldDeleteUsed = typed?.where?.OR?.some((condition) =>
        condition.usedAt ? row.usedAt !== null : false,
      );
      if (shouldDeleteAll || shouldDeleteExpired || shouldDeleteUsed) {
        tokenStore.delete(token);
        count += 1;
      }
    }
    return { count } as never;
  });
}

describe("admin read tools policy", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bitcoin: {
          usd: 70234.12,
          last_updated_at: Math.floor(Date.now() / 1000),
        },
      }),
    } as Response);
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockAdminToolRunCreate.mockResolvedValue({ id: "run_1" } as never);
    mockMiningFindMany.mockResolvedValue([] as never);
    mockVaultFindMany.mockResolvedValue([] as never);
    mockMiningFindFirst.mockResolvedValue(null as never);
    mockVaultFindFirst.mockResolvedValue(null as never);
  });

  it("allows tools in admin/admin context", () => {
    for (const tool of ADMIN_READ_TOOLS) {
      expect(
        isAdminReadToolAllowed(tool, { chatMode: "admin", profile: "admin" }),
      ).toBe(true);
    }
  });

  it("denies tools outside admin context", () => {
    for (const tool of ADMIN_READ_TOOLS) {
      expect(
        isAdminReadToolAllowed(tool, { chatMode: "normal", profile: "admin" }),
      ).toBe(false);
      expect(
        isAdminReadToolAllowed(tool, { chatMode: "review", profile: "admin" }),
      ).toBe(false);
      expect(
        isAdminReadToolAllowed(tool, { chatMode: "admin", profile: "lp" }),
      ).toBe(false);
    }
  });
});

describe("admin read tools registry", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        bitcoin: {
          usd: 70234.12,
          last_updated_at: Math.floor(Date.now() / 1000),
        },
      }),
    } as Response);
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockAdminToolRunCreate.mockResolvedValue({ id: "run_1" } as never);
    mockMiningFindFirst.mockResolvedValue(null as never);
    mockVaultFindFirst.mockResolvedValue(null as never);
  });

  it("returns no tools when policy disallows the context", () => {
    expect(
      getAllowedAdminReadTools({ chatMode: "normal", profile: "admin" }),
    ).toHaveLength(0);
  });

  it("returns all read tools for admin/admin context", () => {
    const tools = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "admin",
    });
    expect(tools.map((tool) => tool.id)).toEqual(
      ADMIN_READ_TOOLS.map((tool) => tool.id),
    );
  });

  it("produces structured tool results", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "read_runtime_capabilities",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await executeAdminReadTool(tool, context);
    expect(result.id).toBe("read_runtime_capabilities");
    expect(result.format).toBe("multiline_text_block");
    expect(result.title).toBe("TOOLED CAPABILITIES (RUNTIME APP)");
    expect(result.lines.some((line) => line.includes("live_internet_tooled: yes"))).toBe(
      true,
    );
    expect(mockAdminToolRunCreate).toHaveBeenCalledTimes(1);
    const [telemetry] = getTelemetryRows();
    expect(telemetry).toEqual(
      expect.objectContaining({
        toolId: "read_runtime_capabilities",
        toolKind: "read",
        mode: "admin",
        profile: "admin",
        status: "success",
        userId: null,
        confirmationTokenUsed: false,
        inputHash: null,
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(telemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("persists read telemetry on failure", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const failingTool: AdminReadToolDefinition = {
      id: "read_runtime_capabilities",
      kind: "read" as const,
      description: "failing read tool",
      riskLevel: "low" as const,
      confirmationRequired: false as const,
      allowedChatModes: ["admin"] as const,
      allowedProfiles: ["admin"] as const,
      resultFormat: "multiline_text_block" as const,
      parameters: { type: "object" as const, properties: {}, additionalProperties: false },
      run: async () => {
        throw new Error("read tool exploded");
      },
    };
    await expect(executeAdminReadTool(failingTool, context, {})).rejects.toThrow(
      "read tool exploded",
    );
    expect(mockAdminToolRunCreate).toHaveBeenCalledTimes(1);
    const [telemetry] = getTelemetryRows();
    expect(telemetry).toEqual(
      expect.objectContaining({
        toolId: "read_runtime_capabilities",
        toolKind: "read",
        mode: "admin",
        profile: "admin",
        status: "failed",
        userId: null,
        confirmationTokenUsed: false,
        inputHash: EMPTY_OBJECT_INPUT_HASH,
        errorCode: "error",
        errorMessage: "read tool exploded",
      }),
    );
    expect(telemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("generate_chart_spec returns payload with provenance metadata", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "generate_chart_spec",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockMiningFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        btcPrice: 70_000,
        hashprice: 120,
        miningMarginScore: 62,
      },
    ] as never);
    mockVaultFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        currentApyLow: 8.2,
        currentApyHigh: 12.1,
        riskScore: 3,
        source: "attested",
      },
    ] as never);

    const result = await executeAdminReadTool(tool, context, {
      intent: "APY trend",
      chartType: "line",
      timeframe: "30d",
    });
    expect(result.id).toBe("generate_chart_spec");
    expect(result.format).toBe("json_object");
    expect(result.payload).toBeTruthy();
    const payload = result.payload as {
      chart?: {
        title?: string;
        provenance?: unknown[];
      };
    };
    expect(payload.chart?.title).toContain("APY trend");
    expect(Array.isArray(payload.chart?.provenance)).toBe(true);
    expect((payload.chart?.provenance ?? []).length).toBeGreaterThan(0);
  });

  it("read_market_snapshot includes CoinGecko live btc fields when available", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "read_market_snapshot",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockMiningFindFirst.mockResolvedValueOnce({
      takenAt: new Date("2026-06-10T00:00:00.000Z"),
      btcPrice: 70000,
      hashprice: 0.082,
      difficulty: 123,
      energyCost: 0.05,
      uptimePct: 99,
      miningMarginScore: 70,
    } as never);
    mockVaultFindFirst.mockResolvedValueOnce({
      takenAt: new Date("2026-06-10T00:00:00.000Z"),
      aumUsdc: 1_000_000,
      currentApyLow: 8,
      currentApyHigh: 12,
      stressedApy: 5,
      riskScore: 42,
      miningMarginScore: 70,
      mode: "balanced",
      source: "computed",
    } as never);

    const result = await executeAdminReadTool(tool, context);
    expect(result.lines.some((line) => line.includes("btc_price_usd_exact_live: 70234.12"))).toBe(
      true,
    );
    expect(result.lines.some((line) => line.includes("btc_price_live_source: coingecko"))).toBe(
      true,
    );
    expect(result.lines.some((line) => line.includes("btc_price_live_freshness_seconds:"))).toBe(
      true,
    );
  });

  it("generate_demo_plan returns ordered non-empty steps with valid admin routes", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "generate_demo_plan",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await executeAdminReadTool(tool, context, {
      objective: "Internal walkthrough",
      audience: "Ops team",
    });
    expect(result.id).toBe("generate_demo_plan");
    expect(result.format).toBe("json_object");
    const payload = result.payload as {
      steps?: Array<{ order: number; route: string }>;
    };
    expect(Array.isArray(payload.steps)).toBe(true);
    expect((payload.steps ?? []).length).toBeGreaterThan(0);
    for (const step of payload.steps ?? []) {
      expect(step.order).toBeGreaterThan(0);
      // Admin routes are under /admin — root (/admin) or a sub-path. The nav
      // whitelist now includes the /admin Operations root, so allow both.
      expect(step.route).toMatch(/^\/admin(\/|$)/);
    }
  });

  it("generate_demo_plan starts product creation objectives at Product Workspace", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "generate_demo_plan",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await executeAdminReadTool(tool, context, {
      objective: "Créer un nouveau produit Defensive avec notes de calcul",
      audience: "Ops team",
    });
    const payload = result.payload as {
      steps?: Array<{ order: number; route: string }>;
      routesWhitelist?: string[];
    };

    expect(payload.steps?.[0]?.route).toBe("/admin/product-workspace");
    // The retired Scenario Lab route is no longer part of the admin nav
    // whitelist, so the demo plan never surfaces it.
    expect(payload.routesWhitelist).not.toContain("/admin/scenario-lab");
  });

  it("export_demo_pack returns structured payload shape", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "export_demo_pack",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockMiningFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        btcPrice: 70_000,
        hashprice: 120,
        miningMarginScore: 62,
      },
    ] as never);
    mockVaultFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        currentApyLow: 8.2,
        currentApyHigh: 12.1,
        riskScore: 3,
        source: "attested",
      },
    ] as never);

    const result = await executeAdminReadTool(tool, context, {
      objective: "Demo objective",
      audience: "Committee",
    });
    expect(result.format).toBe("json_object");
    const payload = result.payload as {
      metadata?: { generatedAt?: string; objective?: string; audience?: string };
      demoPlan?: unknown[];
      charts?: unknown[];
      checklist?: unknown[];
      provenanceFreshnessSummary?: unknown;
    };
    expect(payload.metadata?.objective).toBe("Demo objective");
    expect(payload.metadata?.audience).toBe("Committee");
    expect(typeof payload.metadata?.generatedAt).toBe("string");
    expect(Array.isArray(payload.demoPlan)).toBe(true);
    expect(Array.isArray(payload.charts)).toBe(true);
    expect(Array.isArray(payload.checklist)).toBe(true);
    expect(payload.provenanceFreshnessSummary).toBeTruthy();
  });

  it("export_demo_pack inherits Product Workspace as first route for product creation", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "export_demo_pack",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await executeAdminReadTool(tool, context, {
      objective: "new product creation for BTC Plus",
      audience: "Committee",
      includeCharts: false,
      includeChecklist: false,
    });
    const payload = result.payload as {
      demoPlan?: Array<{ route: string }>;
    };
    expect(payload.demoPlan?.[0]?.route).toBe("/admin/product-workspace");
  });

  it("export_demo_pack honors include toggles", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "export_demo_pack",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const result = await executeAdminReadTool(tool, context, {
      objective: "Demo objective",
      audience: "Committee",
      includeCharts: false,
      includeChecklist: false,
    });
    const payload = result.payload as { charts?: unknown[]; checklist?: unknown[] };
    expect(payload.charts).toEqual([]);
    expect(payload.checklist).toEqual([]);
  });

  it("export_demo_pack is present only in admin/admin context", () => {
    const adminTools = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "admin",
    }).map((tool) => tool.id);
    expect(adminTools).toContain("export_demo_pack");

    const nonAdminModeTools = getAllowedAdminReadTools({
      chatMode: "normal",
      profile: "admin",
    }).map((tool) => tool.id);
    expect(nonAdminModeTools).not.toContain("export_demo_pack");

    const nonAdminProfileTools = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "lp",
    }).map((tool) => tool.id);
    expect(nonAdminProfileTools).not.toContain("export_demo_pack");
  });

  it("export_briefing_pack returns executive-ready payload shape", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_READ_TOOLS.find(
      (candidate) => candidate.id === "export_briefing_pack",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockMiningFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        btcPrice: 70_000,
        hashprice: 120,
        miningMarginScore: 62,
      },
    ] as never);
    mockVaultFindMany.mockResolvedValue([
      {
        takenAt: new Date("2026-06-10T00:00:00.000Z"),
        currentApyLow: 8.2,
        currentApyHigh: 12.1,
        riskScore: 3,
        source: "attested",
      },
    ] as never);

    const result = await executeAdminReadTool(tool, context, {
      objective: "Executive readout",
      audience: "Investment Committee",
      includeCharts: true,
    });
    expect(result.format).toBe("json_object");
    const payload = result.payload as {
      metadata?: { packageType?: string; objective?: string };
      executiveSummary?: { context?: string; highlights?: unknown[] };
      demoPlan?: unknown[];
      charts?: unknown[];
      operationalActionPlan?: Array<{ order: number; bullet: string }>;
      riskNotes?: unknown[];
      provenanceFreshnessSummary?: unknown;
    };
    expect(payload.metadata?.packageType).toBe("executive_briefing");
    expect(payload.metadata?.objective).toBe("Executive readout");
    expect(typeof payload.executiveSummary?.context).toBe("string");
    expect((payload.executiveSummary?.highlights ?? []).length).toBeGreaterThan(1);
    expect(Array.isArray(payload.demoPlan)).toBe(true);
    expect(Array.isArray(payload.charts)).toBe(true);
    expect((payload.operationalActionPlan ?? []).length).toBeGreaterThan(0);
    expect(Array.isArray(payload.riskNotes)).toBe(true);
    expect(payload.provenanceFreshnessSummary).toBeTruthy();
  });

  it("export_briefing_pack is present only in admin/admin context", () => {
    const adminTools = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "admin",
    }).map((tool) => tool.id);
    expect(adminTools).toContain("export_briefing_pack");

    const nonAdminModeTools = getAllowedAdminReadTools({
      chatMode: "normal",
      profile: "admin",
    }).map((tool) => tool.id);
    expect(nonAdminModeTools).not.toContain("export_briefing_pack");

    const nonAdminProfileTools = getAllowedAdminReadTools({
      chatMode: "admin",
      profile: "lp",
    }).map((tool) => tool.id);
    expect(nonAdminProfileTools).not.toContain("export_briefing_pack");
  });
});

describe("admin write tools policy and confirmation", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockAdminToolRunCreate.mockResolvedValue({ id: "run_1" } as never);
  });

  it("denies write tools outside admin mode/profile", () => {
    const normal = getAllowedAdminWriteTools({ chatMode: "normal", profile: "admin" });
    const review = getAllowedAdminWriteTools({ chatMode: "review", profile: "admin" });
    const lp = getAllowedAdminWriteTools({ chatMode: "admin", profile: "lp" });
    expect(normal).toHaveLength(0);
    expect(review).toHaveLength(0);
    expect(lp).toHaveLength(0);
  });

  it("requires confirmation before executing risky write tool", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const first = await executeAdminWriteTool(
      tool,
      context,
      { input: { title: "Ops note", body: "Draft content" } },
      { userId: "admin_test", nowMs: 1_000, ttlMs: 500 },
    );

    expect(first.status).toBe("confirmation_required");
    if (first.status !== "confirmation_required") return;
    expect(first.confirmation.token.length).toBeGreaterThan(10);
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    const [telemetry] = getTelemetryRows();
    expect(telemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "confirmation_required",
        userId: "admin_test",
        confirmationTokenUsed: false,
        inputHash: expect.any(String),
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(telemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("binds minted confirmation token to requesting admin user", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const first = await executeAdminWriteTool(
      tool,
      context,
      { input: { title: "Bound token", body: "user binding check" } },
      { userId: "admin_bound_user", nowMs: 11_000, ttlMs: 1_000 },
    );
    expect(first.status).toBe("confirmation_required");
    if (first.status !== "confirmation_required") return;

    expect(tokenStore.get(first.confirmation.token)?.userId).toBe("admin_bound_user");
  });

  it("enforces confirmation token single-use semantics", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_draft_1" } as never);
    const input = { title: "Ops note", body: "Draft content", author: "admin" };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 2_000, ttlMs: 10_000 },
    );
    if (first.status !== "confirmation_required") return;
    const token = first.confirmation.token;

    const second = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: token },
      { userId: "admin_test", nowMs: 2_100, ttlMs: 10_000 },
    );
    expect(second.status).toBe("executed");
    expect(mockFeedbackCreate).toHaveBeenCalledTimes(1);
    const successTelemetry = getTelemetryRows().find((row) => row.status === "success");
    expect(successTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "success",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: REVIEW_NOTE_HASH_WITH_AUTHOR,
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(successTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { userId: "admin_test", nowMs: 2_200, ttlMs: 10_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_used");
    const blockedTelemetry = getTelemetryRows().find(
      (row) =>
        row.status === "blocked" && row.errorMessage === "admin_write_confirmation_used",
    );
    expect(blockedTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "blocked",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: REVIEW_NOTE_HASH_WITH_AUTHOR,
        errorCode: "confirmation_rejected",
        errorMessage: "admin_write_confirmation_used",
      }),
    );
    expect(blockedTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("enforces token replay race semantics with parallel confirms", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_race_1" } as never);
    const input = { title: "Race note", body: "Parallel confirmation attempt" };
    const initial = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 2_500, ttlMs: 10_000 },
    );
    if (initial.status !== "confirmation_required") return;
    const token = initial.confirmation.token;

    const [first, second] = await Promise.allSettled([
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { userId: "admin_test", nowMs: 2_501, ttlMs: 10_000 },
      ),
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { userId: "admin_test", nowMs: 2_501, ttlMs: 10_000 },
      ),
    ]);

    const fulfilled = [first, second].filter(
      (entry): entry is PromiseFulfilledResult<Awaited<typeof first extends PromiseSettledResult<infer T> ? T : never>> =>
        entry.status === "fulfilled",
    );
    const rejected = [first, second].filter(
      (entry): entry is PromiseRejectedResult => entry.status === "rejected",
    );

    expect(fulfilled).toHaveLength(1);
    expect(fulfilled[0]?.value.status).toBe("executed");
    expect(rejected).toHaveLength(1);
    expect((rejected[0]?.reason as Error).message).toBe("admin_write_confirmation_used");
    expect(mockFeedbackCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects confirmation replay by another admin user", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const input = { title: "Bound token", body: "user-bound confirm" };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_a", nowMs: 2_700, ttlMs: 10_000 },
    );
    if (first.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: first.confirmation.token },
        { userId: "admin_b", nowMs: 2_710, ttlMs: 10_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_mismatch");
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
  });

  it("maps confirmation-required then mismatch to telemetry statuses", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const input = { title: "Telemetry mapping", body: "status mapping check" };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_map_a", nowMs: 14_000, ttlMs: 2_000 },
    );
    if (first.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: first.confirmation.token },
        { userId: "admin_map_b", nowMs: 14_010, ttlMs: 2_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_mismatch");

    const [firstTelemetry, secondTelemetry] = getTelemetryRows();
    expect(firstTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "confirmation_required",
        userId: "admin_map_a",
        confirmationTokenUsed: false,
        inputHash: expect.any(String),
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(secondTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "blocked",
        userId: "admin_map_b",
        confirmationTokenUsed: true,
        inputHash: expect.any(String),
        errorCode: "confirmation_rejected",
        errorMessage: "admin_write_confirmation_mismatch",
      }),
    );
  });

  it("rejects expired confirmation token", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const input = { title: "Ops note", body: "Draft content" };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 3_000, ttlMs: 100 },
    );
    if (first.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: first.confirmation.token },
        { userId: "admin_test", nowMs: 3_101, ttlMs: 100 },
      ),
    ).rejects.toThrow("admin_write_confirmation_expired");
    const blockedTelemetry = getTelemetryRows().find(
      (row) =>
        row.status === "blocked" &&
        row.errorMessage === "admin_write_confirmation_expired",
    );
    expect(blockedTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "blocked",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: expect.any(String),
        errorCode: "confirmation_rejected",
        errorMessage: "admin_write_confirmation_expired",
      }),
    );
    expect(blockedTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("allows retry after expiry by minting a new token", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const input = { title: "Retry note", body: "Expired then retried" };
    const initial = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 6_000, ttlMs: 50 },
    );
    if (initial.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: initial.confirmation.token },
        { userId: "admin_test", nowMs: 6_051, ttlMs: 50 },
      ),
    ).rejects.toThrow("admin_write_confirmation_expired");

    const retry = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 6_060, ttlMs: 1_000 },
    );
    expect(retry.status).toBe("confirmation_required");
    if (retry.status !== "confirmation_required") return;
    expect(retry.confirmation.token).not.toBe(initial.confirmation.token);

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_retry_1" } as never);
    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: retry.confirmation.token },
      { userId: "admin_test", nowMs: 6_061, ttlMs: 1_000 },
    );
    expect(executed.status).toBe("executed");
    expect(mockFeedbackCreate).toHaveBeenCalledTimes(1);
  });

  it("rejects confirmation token when confirmed payload differs", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    const originalInput = { title: "Ops note", body: "Draft content" };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input: originalInput },
      { userId: "admin_test", nowMs: 3_500, ttlMs: 1_000 },
    );
    if (first.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        {
          input: { ...originalInput, body: "Changed body after confirmation request" },
          confirmedToken: first.confirmation.token,
        },
        { userId: "admin_test", nowMs: 3_550, ttlMs: 1_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_mismatch");
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    const mismatchTelemetry = getTelemetryRows().find(
      (row) =>
        row.status === "blocked" &&
        row.errorMessage === "admin_write_confirmation_mismatch",
    );
    expect(mismatchTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "blocked",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: expect.any(String),
        errorCode: "confirmation_rejected",
        errorMessage: "admin_write_confirmation_mismatch",
      }),
    );
    expect(mismatchTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("accepts semantically identical payload with reordered keys", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_canonical_1" } as never);
    const firstInput = {
      title: "Canonical note",
      body: "Stable hash payload order",
      author: "admin",
    };
    const confirmation = await executeAdminWriteTool(
      tool,
      context,
      { input: firstInput },
      { userId: "admin_test", nowMs: 12_000, ttlMs: 1_000 },
    );
    if (confirmation.status !== "confirmation_required") return;

    const reorderedInput = {
      author: "admin",
      body: "Stable hash payload order",
      title: "Canonical note",
    };
    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input: reorderedInput, confirmedToken: confirmation.confirmation.token },
      { userId: "admin_test", nowMs: 12_010, ttlMs: 1_000 },
    );
    expect(executed.status).toBe("executed");
    expect(mockFeedbackCreate).toHaveBeenCalledTimes(1);
  });

  it("keeps telemetry inputHash stable across key-reordered payloads", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_hash_stability_1" } as never);
    const mintInput = {
      title: "Stable telemetry hash",
      body: "Confirm with reordered keys",
      author: "admin",
    };
    const mint = await executeAdminWriteTool(
      tool,
      context,
      { input: mintInput },
      { userId: "admin_hash", nowMs: 20_000, ttlMs: 2_000 },
    );
    expect(mint.status).toBe("confirmation_required");
    if (mint.status !== "confirmation_required") return;

    const confirmInput = {
      author: "admin",
      body: "Confirm with reordered keys",
      title: "Stable telemetry hash",
    };
    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input: confirmInput, confirmedToken: mint.confirmation.token },
      { userId: "admin_hash", nowMs: 20_010, ttlMs: 2_000 },
    );
    expect(executed.status).toBe("executed");

    const [mintTelemetry, successTelemetry] = getTelemetryRows();
    expect(mintTelemetry?.inputHash).toBe(successTelemetry?.inputHash);
    expect(mintTelemetry?.inputHash).toBeTypeOf("string");
  });

  it("rejects confirmation when token toolId does not match target write tool", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const reviewTool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_review_note_draft",
    );
    const governanceTool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_governance_proposal_draft",
    );
    expect(reviewTool).toBeDefined();
    expect(governanceTool).toBeDefined();
    if (!reviewTool || !governanceTool) return;

    const reviewDraft = await executeAdminWriteTool(
      reviewTool,
      context,
      { input: { title: "Review token", body: "Bound to review tool" } },
      { userId: "admin_test", nowMs: 7_000, ttlMs: 1_000 },
    );
    if (reviewDraft.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        governanceTool,
        context,
        {
          input: {
            vaultDeploymentId: "vault_123",
            actionType: "pause",
            justification:
              "This is a safe draft-only pause proposal for governance review.",
            proposedBy: "0xabc",
            requiredSigners: 2,
            calldata: "{\"kind\":\"noop\"}",
          },
          confirmedToken: reviewDraft.confirmation.token,
        },
        { userId: "admin_test", nowMs: 7_010, ttlMs: 1_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_mismatch");
    expect(mockGovernanceCreate).not.toHaveBeenCalled();
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
  });

  it("executes confirmed governance draft write and persists DRAFT row", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const tool = ADMIN_WRITE_TOOLS.find(
      (candidate) => candidate.id === "create_governance_proposal_draft",
    );
    expect(tool).toBeDefined();
    if (!tool) return;

    mockGovernanceCreate.mockResolvedValueOnce({
      id: "gov_1",
      state: "DRAFT",
    } as never);

    const input = {
      vaultDeploymentId: "vault_123",
      actionType: "pause",
      justification: "This is a safe draft-only pause proposal for governance review.",
      proposedBy: "0xabc",
      requiredSigners: 2,
      calldata: "{\"kind\":\"noop\"}",
    };
    const first = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { userId: "admin_test", nowMs: 4_000, ttlMs: 1_000 },
    );
    if (first.status !== "confirmation_required") return;

    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: first.confirmation.token },
      { userId: "admin_test", nowMs: 4_010, ttlMs: 1_000 },
    );

    expect(executed.status).toBe("executed");
    if (executed.status !== "executed") return;
    expect(executed.result.createdEntityId).toBe("gov_1");
    expect(mockGovernanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "DRAFT", actionType: "pause" }),
      }),
    );
    const successTelemetry = getTelemetryRows().find(
      (row) =>
        row.toolId === "create_governance_proposal_draft" && row.status === "success",
    );
    expect(successTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_governance_proposal_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "success",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: expect.any(String),
        errorCode: null,
        errorMessage: null,
      }),
    );
    expect(successTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("persists write telemetry on execution failure", async () => {
    const context = { chatMode: "admin" as const, profile: "admin" as const };
    const failingTool: AdminWriteToolDefinition = {
      id: "create_review_note_draft",
      kind: "write" as const,
      description: "failing write tool",
      riskLevel: "medium" as const,
      confirmationRequired: true as const,
      allowedChatModes: ["admin"] as const,
      allowedProfiles: ["admin"] as const,
      run: async () => {
        throw new Error("write tool exploded");
      },
    };
    const initial = await executeAdminWriteTool(
      failingTool,
      context,
      { input: { title: "x", body: "y" } },
      { userId: "admin_test", nowMs: 10_000, ttlMs: 1_000 },
    );
    if (initial.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        failingTool,
        context,
        {
          input: { title: "x", body: "y" },
          confirmedToken: initial.confirmation.token,
        },
        { userId: "admin_test", nowMs: 10_100, ttlMs: 1_000 },
      ),
    ).rejects.toThrow("write tool exploded");
    const failedTelemetry = getTelemetryRows().at(-1);
    expect(failedTelemetry).toEqual(
      expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        mode: "admin",
        profile: "admin",
        status: "failed",
        userId: "admin_test",
        confirmationTokenUsed: true,
        inputHash: expect.any(String),
        errorCode: "error",
        errorMessage: "write tool exploded",
      }),
    );
    expect(failedTelemetry?.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

// ---------------------------------------------------------------------------
// Outreach write tools — the real-effect actions (source / draft / send run).
// These verify the END-TO-END dispatch through executeAdminWriteTool:
// confirmation is mandatory, the delegated effect module is only reached AFTER
// a valid confirm, and a SUGGEST send run sends nothing. Effect modules are
// mocked (no Apollo, no Resend, no DB write).
// ---------------------------------------------------------------------------

describe("outreach write tools — confirmed dispatch (no real effect)", () => {
  const context = { chatMode: "admin" as const, profile: "admin" as const };

  beforeEach(async () => {
    vi.clearAllMocks();
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockAdminToolRunCreate.mockResolvedValue({ id: "run_1" } as never);
  });

  function tool(id: string): AdminWriteToolDefinition {
    const found = ADMIN_WRITE_TOOLS.find((t) => t.id === id);
    if (!found) throw new Error(`missing tool ${id}`);
    return found;
  }

  it("outreach_trigger_send_run: SUGGEST run executes but sends NOTHING", async () => {
    // The handler is the SAME governed job the cron runs; at SUGGEST it returns
    // a zero-send result. We assert the tool surfaces that and never bypasses it.
    mockOutreachAutoSendHandler.mockResolvedValue({
      autonomy: "SUGGEST",
      budget: 0,
      sent: 0,
      suppressed: 0,
      failed: 0,
      skippedIneligible: 0,
    });

    const send = tool("outreach_trigger_send_run");

    // No token → confirmation required, handler NOT called yet.
    const first = await executeAdminWriteTool(
      send,
      context,
      { input: {} },
      { userId: "admin_test", nowMs: 1_000, ttlMs: 60_000 },
    );
    expect(first.status).toBe("confirmation_required");
    if (first.status !== "confirmation_required") return;
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled();

    // Confirm → executes the governed handler exactly once.
    const second = await executeAdminWriteTool(
      send,
      context,
      { input: {}, confirmedToken: first.confirmation.token },
      { userId: "admin_test", nowMs: 2_000 },
    );
    expect(second.status).toBe("executed");
    if (second.status !== "executed") return;
    expect(mockOutreachAutoSendHandler).toHaveBeenCalledTimes(1);
    // The surfaced run reflects the SUGGEST posture: zero sends.
    expect(second.result.lines.join("\n")).toMatch(/autonomy: SUGGEST/);
    expect(second.result.lines.join("\n")).toMatch(/sent: 0/);
    expect(second.result.lines.join("\n")).toMatch(/nothing auto-sends/i);
  });

  it("outreach_draft_email: confirmed run drafts only — never triggers a send", async () => {
    mockDraftEmailForProspect.mockResolvedValue({
      emailId: "email_1",
      toEmail: "lead@example.com",
      subject: "Intro",
    });

    const draft = tool("outreach_draft_email");
    const input = { prospectId: "prospect_1" };

    const first = await executeAdminWriteTool(
      draft,
      context,
      { input },
      { userId: "admin_test", nowMs: 1_000, ttlMs: 60_000 },
    );
    expect(first.status).toBe("confirmation_required");
    if (first.status !== "confirmation_required") return;
    expect(mockDraftEmailForProspect).not.toHaveBeenCalled();

    const second = await executeAdminWriteTool(
      draft,
      context,
      { input, confirmedToken: first.confirmation.token },
      { userId: "admin_test", nowMs: 2_000 },
    );
    expect(second.status).toBe("executed");
    if (second.status !== "executed") return;
    expect(mockDraftEmailForProspect).toHaveBeenCalledWith("prospect_1");
    // The send handler is NEVER reached from the draft tool.
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled();
    expect(second.result.lines.join("\n")).toMatch(/NOT sent/i);
  });

  it("outreach_source_leads: invalid input is rejected BEFORE a token is minted", async () => {
    const source = tool("outreach_source_leads");
    // validateWriteToolInput runs the Zod schema before minting a token, so an
    // invalid count throws (ZodError) at the validation step — no token, no run.
    await expect(
      executeAdminWriteTool(
        source,
        context,
        { input: { count: -5 } }, // violates positive-int schema
        { userId: "admin_test", nowMs: 1_000 },
      ),
    ).rejects.toThrow();
    // No confirmation row created, no sourcing performed.
    expect(tokenStore.size).toBe(0);
    expect(mockRunSourcing).not.toHaveBeenCalled();
  });

  it("outreach write tools are denied (and never execute) outside admin/admin", async () => {
    const send = tool("outreach_trigger_send_run");
    await expect(
      executeAdminWriteTool(
        send,
        { chatMode: "admin", profile: "lp" },
        { input: {} },
        { userId: "lp_user", nowMs: 1_000 },
      ),
    ).rejects.toThrow("admin_write_tool_not_allowed");
    expect(mockOutreachAutoSendHandler).not.toHaveBeenCalled();
  });
});
