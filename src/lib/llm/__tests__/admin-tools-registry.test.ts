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
    llmRun: { create: vi.fn() },
    miningMetric: { findMany: vi.fn() },
    vaultSnapshot: { findMany: vi.fn() },
  },
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
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockMiningFindMany = vi.mocked(prisma.miningMetric.findMany);
const mockVaultFindMany = vi.mocked(prisma.vaultSnapshot.findMany);

const tokenStore = new Map<string, ConfirmationRow>();

function setupConfirmationMocks(): void {
  mockAdminWriteConfirmationCreate.mockImplementation(async (args: unknown) => {
    const data = (args as { data: {
      token: string;
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
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockLlmRunCreate.mockResolvedValue({ id: "run_1" } as never);
    mockMiningFindMany.mockResolvedValue([] as never);
    mockVaultFindMany.mockResolvedValue([] as never);
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
    tokenStore.clear();
    setupConfirmationMocks();
    await clearWriteConfirmationsForTests();
    mockLlmRunCreate.mockResolvedValue({ id: "run_1" } as never);
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
    expect(result.title).toBe("CAPACITES OUTILLEES (RUNTIME APP)");
    expect(result.lines.some((line) => line.includes("internet_live_outille: no"))).toBe(
      true,
    );
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "read_runtime_capabilities",
          status: "success",
        }),
      }),
    );
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
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "read_runtime_capabilities",
          status: "failed",
          errorMessage: "read tool exploded",
        }),
      }),
    );
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
      expect(step.route.startsWith("/admin/")).toBe(true);
    }
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
    mockLlmRunCreate.mockResolvedValue({ id: "run_1" } as never);
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
      { nowMs: 1_000, ttlMs: 500 },
    );

    expect(first.status).toBe("confirmation_required");
    if (first.status !== "confirmation_required") return;
    expect(first.confirmation.token.length).toBeGreaterThan(10);
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "confirmation_required",
        }),
      }),
    );
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
      { nowMs: 2_000, ttlMs: 10_000 },
    );
    if (first.status !== "confirmation_required") return;
    const token = first.confirmation.token;

    const second = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: token },
      { nowMs: 2_100, ttlMs: 10_000 },
    );
    expect(second.status).toBe("executed");
    expect(mockFeedbackCreate).toHaveBeenCalledTimes(1);
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "success",
        }),
      }),
    );

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { nowMs: 2_200, ttlMs: 10_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_used");
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "blocked",
          errorMessage: "admin_write_confirmation_used",
        }),
      }),
    );
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
      { nowMs: 2_500, ttlMs: 10_000 },
    );
    if (initial.status !== "confirmation_required") return;
    const token = initial.confirmation.token;

    const [first, second] = await Promise.allSettled([
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { nowMs: 2_501, ttlMs: 10_000 },
      ),
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { nowMs: 2_501, ttlMs: 10_000 },
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
      { nowMs: 3_000, ttlMs: 100 },
    );
    if (first.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: first.confirmation.token },
        { nowMs: 3_101, ttlMs: 100 },
      ),
    ).rejects.toThrow("admin_write_confirmation_expired");
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "blocked",
          errorMessage: "admin_write_confirmation_expired",
        }),
      }),
    );
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
      { nowMs: 6_000, ttlMs: 50 },
    );
    if (initial.status !== "confirmation_required") return;

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: initial.confirmation.token },
        { nowMs: 6_051, ttlMs: 50 },
      ),
    ).rejects.toThrow("admin_write_confirmation_expired");

    const retry = await executeAdminWriteTool(
      tool,
      context,
      { input },
      { nowMs: 6_060, ttlMs: 1_000 },
    );
    expect(retry.status).toBe("confirmation_required");
    if (retry.status !== "confirmation_required") return;
    expect(retry.confirmation.token).not.toBe(initial.confirmation.token);

    mockFeedbackCreate.mockResolvedValueOnce({ id: "fb_retry_1" } as never);
    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: retry.confirmation.token },
      { nowMs: 6_061, ttlMs: 1_000 },
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
      { nowMs: 3_500, ttlMs: 1_000 },
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
        { nowMs: 3_550, ttlMs: 1_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_mismatch");
    expect(mockFeedbackCreate).not.toHaveBeenCalled();
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "blocked",
          errorMessage: "admin_write_confirmation_mismatch",
        }),
      }),
    );
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
      { nowMs: 7_000, ttlMs: 1_000 },
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
        { nowMs: 7_010, ttlMs: 1_000 },
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
      { nowMs: 4_000, ttlMs: 1_000 },
    );
    if (first.status !== "confirmation_required") return;

    const executed = await executeAdminWriteTool(
      tool,
      context,
      { input, confirmedToken: first.confirmation.token },
      { nowMs: 4_010, ttlMs: 1_000 },
    );

    expect(executed.status).toBe("executed");
    if (executed.status !== "executed") return;
    expect(executed.result.createdEntityId).toBe("gov_1");
    expect(mockGovernanceCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: "DRAFT", actionType: "pause" }),
      }),
    );
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_governance_proposal_draft",
          status: "success",
        }),
      }),
    );
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
      { nowMs: 10_000, ttlMs: 1_000 },
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
        { nowMs: 10_100, ttlMs: 1_000 },
      ),
    ).rejects.toThrow("write tool exploded");
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "failed",
          errorMessage: "write tool exploded",
        }),
      }),
    );
  });
});
