import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    llmRun: { create: vi.fn() },
  },
}));

vi.mock("@/lib/llm/tools", () => ({
  ADMIN_READ_TOOL_IDS: [
    "read_runtime_capabilities",
    "generate_chart_spec",
    "generate_demo_plan",
    "export_demo_pack",
    "export_briefing_pack",
  ],
  ADMIN_WRITE_TOOL_IDS: [
    "create_review_note_draft",
    "create_governance_proposal_draft",
  ],
  getAllowedAdminReadTools: vi.fn(),
  getAllowedAdminWriteTools: vi.fn(),
  executeAdminReadTool: vi.fn(),
  executeAdminWriteTool: vi.fn(),
}));

import { GET, POST } from "@/app/api/admin/chat-tools/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  executeAdminReadTool,
  executeAdminWriteTool,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
} from "@/lib/llm/tools";
import { assertBodySize } from "@/lib/rate-limit";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetAllowedAdminReadTools = vi.mocked(getAllowedAdminReadTools);
const mockGetAllowedAdminWriteTools = vi.mocked(getAllowedAdminWriteTools);
const mockExecuteAdminReadTool = vi.mocked(executeAdminReadTool);
const mockExecuteAdminWriteTool = vi.mocked(executeAdminWriteTool);
const mockLlmRunCreate = vi.mocked(prisma.llmRun.create);
const mockAssertBodySize = vi.mocked(assertBodySize);

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/chat-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

describe("GET /api/admin/chat-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("denies non-admin users", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Admin access required"));

    const res = await GET();

    expect(res.status).toBe(403);
  });

  it("returns 401 when authentication is explicitly required", async () => {
    mockRequireAdmin.mockRejectedValue(new Error("Authentication required"));

    const res = await GET();

    expect(res.status).toBe(401);
  });
});

describe("POST /api/admin/chat-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" });
    mockLlmRunCreate.mockResolvedValue({ id: "run_1" } as never);
    mockGetAllowedAdminReadTools.mockReturnValue([] as never);
    mockGetAllowedAdminWriteTools.mockReturnValue(
      [
        {
          id: "create_review_note_draft",
          kind: "write",
          description: "Create admin review note draft",
          riskLevel: "medium",
          confirmationRequired: true,
          allowedChatModes: ["admin"],
          allowedProfiles: ["admin"],
        },
      ] as never,
    );
  });

  it("returns 400 on invalid payload", async () => {
    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("denies non-admin user for execute_read export_demo_pack", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Admin access required"));
    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: { objective: "demo", audience: "ops" },
      }),
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when authentication is explicitly required", async () => {
    mockRequireAdmin.mockRejectedValueOnce(new Error("Authentication required"));

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: { objective: "demo", audience: "ops" },
      }),
    );

    expect(res.status).toBe(401);
  });

  it("returns 413 when body size assertion fails", async () => {
    mockAssertBodySize.mockRejectedValueOnce(new Error("too_large"));

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: { objective: "demo", audience: "ops" },
      }),
    );

    expect(res.status).toBe(413);
    await expect(res.json()).resolves.toEqual({ error: "Request too large" });
  });

  it("returns 400 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/admin/chat-tools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ invalid json",
    }) as unknown as NextRequest;

    const res = await POST(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
  });

  it("executes read tool with input payload", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue(
      [
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
              chartType: { type: "string" },
            },
            required: ["intent", "chartType"],
            additionalProperties: false,
          },
        },
      ] as never,
    );
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "generate_chart_spec",
      format: "json_object",
      title: "CHART SPEC",
      lines: ["- intent: APY trend"],
      payload: { chart: { title: "APY trend (30d)" } },
    } as never);

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "generate_chart_spec",
        input: { intent: "APY trend", chartType: "line", timeframe: "30d" },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      result?: { payload?: { chart?: { title?: string } } };
    };
    expect(body.status).toBe("executed");
    expect(body.result?.payload?.chart?.title).toContain("APY trend");
    expect(mockExecuteAdminReadTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "generate_chart_spec" }),
      { chatMode: "admin", profile: "admin" },
      { intent: "APY trend", chartType: "line", timeframe: "30d" },
      { userId: "admin_1" },
    );
  });

  it("executes export_demo_pack for admin read path", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue(
      [
        {
          id: "export_demo_pack",
          kind: "read",
          description: "Export structured demo pack",
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
        },
      ] as never,
    );
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "export_demo_pack",
      format: "json_object",
      title: "DEMO PACK",
      lines: ["- plan_steps: 3", "- charts: 2"],
      payload: { metadata: { objective: "Investor demo" }, demoPlan: [] },
    } as never);

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: {
          objective: "Investor demo",
          audience: "IC",
          includeCharts: true,
          includeChecklist: false,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      result?: { payload?: { metadata?: { objective?: string } } };
    };
    expect(body.status).toBe("executed");
    expect(body.result?.payload?.metadata?.objective).toBe("Investor demo");
  });

  it("denies execute_read when requested tool is not allowlisted", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([] as never);
    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: { objective: "x", audience: "y" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "export_demo_pack",
          status: "blocked",
          errorMessage: "read_tool_not_allowed",
        }),
      }),
    );
  });

  it("returns 500 when execute_read tool throws", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue(
      [
        {
          id: "export_demo_pack",
          kind: "read",
          description: "Export structured demo pack",
          riskLevel: "low",
          confirmationRequired: false,
          allowedChatModes: ["admin"],
          allowedProfiles: ["admin"],
          resultFormat: "json_object",
          parameters: {},
        },
      ] as never,
    );
    mockExecuteAdminReadTool.mockRejectedValueOnce(new Error("read_failed"));

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_demo_pack",
        input: { objective: "demo", audience: "ops" },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Read tool execution failed" });
  });

  it("executes export_briefing_pack for admin read path", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue(
      [
        {
          id: "export_briefing_pack",
          kind: "read",
          description: "Export executive-ready briefing package",
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
        },
      ] as never,
    );
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "export_briefing_pack",
      format: "json_object",
      title: "BRIEFING PACK",
      lines: ["- plan_steps: 3", "- action_items: 3"],
      payload: {
        metadata: { objective: "Exec briefing" },
        executiveSummary: { context: "Prepared for IC." },
      },
    } as never);

    const res = await POST(
      makeRequest({
        action: "execute_read",
        toolId: "export_briefing_pack",
        input: {
          objective: "Exec briefing",
          audience: "IC",
          includeCharts: true,
        },
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      result?: { payload?: { metadata?: { objective?: string } } };
    };
    expect(body.status).toBe("executed");
    expect(body.result?.payload?.metadata?.objective).toBe("Exec briefing");
  });

  it("write tool requires confirmation first", async () => {
    mockExecuteAdminWriteTool.mockResolvedValue({
      status: "confirmation_required",
      toolId: "create_review_note_draft",
      confirmation: {
        token: "token_1",
        expiresAtIso: "2026-06-12T00:00:00.000Z",
        summary: "create_review_note_draft requires explicit confirmation",
      },
    });

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; confirmation?: { token: string } };
    expect(body.status).toBe("confirmation_required");
    expect(body.confirmation?.token).toBe("token_1");
    expect(mockExecuteAdminWriteTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: "create_review_note_draft" }),
      { chatMode: "admin", profile: "admin" },
      { input: { title: "t", body: "b" }, confirmedToken: undefined },
      { userId: "admin_1" },
    );
  });

  it("confirmed execution works", async () => {
    mockExecuteAdminWriteTool.mockResolvedValue({
      status: "executed",
      toolId: "create_review_note_draft",
      result: {
        title: "REVIEW NOTE DRAFT CREATED",
        lines: ["- id: fb_1"],
        createdEntityId: "fb_1",
      },
    });

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
        confirmedToken: "token_1",
      }),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; result?: { createdEntityId: string } };
    expect(body.status).toBe("executed");
    expect(body.result?.createdEntityId).toBe("fb_1");
  });

  it("rejects expired/invalid token", async () => {
    mockExecuteAdminWriteTool.mockRejectedValue(
      new Error("admin_write_confirmation_expired"),
    );

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
        confirmedToken: "expired",
      }),
    );

    expect(res.status).toBe(410);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("expired");
  });

  it("maps non-expired confirmation errors to 409", async () => {
    mockExecuteAdminWriteTool.mockRejectedValue(
      new Error("admin_write_confirmation_mismatch"),
    );

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
        confirmedToken: "bad_token",
      }),
    );

    expect(res.status).toBe(409);
    const body = (await res.json()) as { code?: string; error?: string };
    expect(body.code).toBe("mismatch");
    expect(body.error).toBe("Write confirmation rejected");
  });

  it("records blocked telemetry when write tool is not allowlisted", async () => {
    mockGetAllowedAdminWriteTools.mockReturnValue([] as never);
    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
      }),
    );
    expect(res.status).toBe(403);
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "blocked",
          errorMessage: "write_tool_not_allowed",
        }),
      }),
    );
  });

  it("returns 400 for invalid write input errors", async () => {
    mockExecuteAdminWriteTool.mockRejectedValue(new Error("invalid_title"));

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "", body: "b" },
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid write input" });
  });

  it("records telemetry when write executor reports not allowed", async () => {
    mockExecuteAdminWriteTool.mockRejectedValue(
      new Error("admin_write_tool_not_allowed"),
    );

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
      }),
    );

    expect(res.status).toBe(403);
    expect(mockLlmRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          promptHash: "create_review_note_draft",
          status: "blocked",
          errorMessage: "write_tool_not_allowed",
        }),
      }),
    );
  });

  it("returns 500 on unexpected write execution failure", async () => {
    mockExecuteAdminWriteTool.mockRejectedValue(new Error("write_failed"));

    const res = await POST(
      makeRequest({
        action: "execute_write",
        toolId: "create_review_note_draft",
        input: { title: "t", body: "b" },
      }),
    );

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Write tool execution failed" });
  });
});
