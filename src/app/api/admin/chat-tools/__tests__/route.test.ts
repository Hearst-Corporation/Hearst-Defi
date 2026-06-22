import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NextRequest } from "next/server";

vi.mock("server-only", () => ({}));

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  assertBodySize: vi.fn().mockResolvedValue(undefined),
  assertRateLimit: vi.fn().mockResolvedValue(undefined),
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
    adminToolRun: { create: vi.fn() },
  },
}));

vi.mock("@/lib/llm/tools", async () => {
  const actual = await vi.importActual<typeof import("@/lib/llm/tools")>(
    "@/lib/llm/tools",
  );
  return {
    ...actual,
    getAllowedAdminReadTools: vi.fn(),
    getAllowedAdminWriteTools: vi.fn(),
    executeAdminReadTool: vi.fn(),
    executeAdminWriteTool: vi.fn(),
    projectAdminReadResultForExternal: vi.fn((result: unknown) => result),
  };
});

import { GET, POST } from "@/app/api/admin/chat-tools/route";
import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  executeAdminReadTool,
  executeAdminWriteTool,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
  projectAdminReadResultForExternal,
} from "@/lib/llm/tools";
import { projectAdminReadResultForExternal as realProjectAdminReadResultForExternal } from "@/lib/llm/tools/redaction";
import { assertBodySize, assertRateLimit } from "@/lib/rate-limit";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetAllowedAdminReadTools = vi.mocked(getAllowedAdminReadTools);
const mockGetAllowedAdminWriteTools = vi.mocked(getAllowedAdminWriteTools);
const mockExecuteAdminReadTool = vi.mocked(executeAdminReadTool);
const mockExecuteAdminWriteTool = vi.mocked(executeAdminWriteTool);
const mockProjectAdminReadResultForExternal = vi.mocked(projectAdminReadResultForExternal);
const mockAdminToolRunCreate = vi.mocked(prisma.adminToolRun.create);
const mockAssertBodySize = vi.mocked(assertBodySize);
const mockAssertRateLimit = vi.mocked(assertRateLimit);

const AUTH_FAILURE_MESSAGES = [
  "Admin access required",
  "Authentication required",
  "DB timeout while resolving admin",
] as const;

const DEMO_READ_TOOL = {
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
    },
    required: ["objective", "audience"],
    additionalProperties: false,
  },
} as const;

const REVIEW_NOTE_WRITE_TOOL = {
  id: "create_review_note_draft",
  kind: "write",
  description: "Create admin review note draft",
  riskLevel: "medium",
  confirmationRequired: true,
  allowedChatModes: ["admin"],
  allowedProfiles: ["admin"],
} as const;

function makeRequest(body: unknown): NextRequest {
  return new Request("http://localhost/api/admin/chat-tools", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function buildReadPayload() {
  return {
    action: "execute_read" as const,
    toolId: "export_demo_pack" as const,
    input: { objective: "demo", audience: "ops" },
  };
}

function buildWritePayload(overrides?: Partial<{ confirmedToken: string }>) {
  return {
    action: "execute_write" as const,
    toolId: "create_review_note_draft" as const,
    input: { title: "t", body: "b" },
    ...overrides,
  };
}

describe("GET /api/admin/chat-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it.each(AUTH_FAILURE_MESSAGES)(
    "maps auth failure '%s' to the public 401 contract",
    async (message) => {
      mockRequireAdmin.mockRejectedValueOnce(new Error(message));

      const res = await GET();

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
    },
  );
});

describe("POST /api/admin/chat-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" });
    mockAssertRateLimit.mockResolvedValue(undefined);
    mockAdminToolRunCreate.mockResolvedValue({ id: "run_1" } as never);
    mockProjectAdminReadResultForExternal.mockImplementation((result) =>
      realProjectAdminReadResultForExternal(result),
    );
    mockGetAllowedAdminReadTools.mockReturnValue([DEMO_READ_TOOL] as never);
    mockGetAllowedAdminWriteTools.mockReturnValue([REVIEW_NOTE_WRITE_TOOL] as never);
  });

  it.each(AUTH_FAILURE_MESSAGES)(
    "maps POST auth failure '%s' to the public 401 contract",
    async (message) => {
      mockRequireAdmin.mockRejectedValueOnce(new Error(message));

      const res = await POST(makeRequest(buildReadPayload()));

      expect(res.status).toBe(401);
      await expect(res.json()).resolves.toEqual({ error: "Authentication required" });
    },
  );

  it("returns 413 when body size assertion fails", async () => {
    mockAssertBodySize.mockRejectedValueOnce(new Error("too_large"));

    const res = await POST(makeRequest(buildReadPayload()));

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

  it("returns 429 for read rate-limit and uses read bucket", async () => {
    mockAssertRateLimit.mockRejectedValueOnce(new Error("rate_limited"));

    const res = await POST(makeRequest(buildReadPayload()));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      error: "Too many requests — try again in a moment.",
    });
    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      "admin-chat-tools:read:admin_1",
      30,
      60_000,
    );
  });

  it("returns 429 for write rate-limit and uses write bucket", async () => {
    mockAssertRateLimit.mockRejectedValueOnce(new Error("rate_limited"));

    const res = await POST(makeRequest(buildWritePayload()));

    expect(res.status).toBe(429);
    await expect(res.json()).resolves.toEqual({
      error: "Too many requests — try again in a moment.",
    });
    expect(mockAssertRateLimit).toHaveBeenCalledWith(
      "admin-chat-tools:write:admin_1",
      30,
      60_000,
    );
  });

  it("redacts non-allowlisted fields from execute_read response payload", async () => {
    mockExecuteAdminReadTool.mockResolvedValue({
      id: "export_demo_pack",
      format: "json_object",
      title: "DEMO PACK",
      lines: ["- plan_steps: 1"],
      payload: {
        metadata: {
          generatedAt: "2026-06-13T00:00:00.000Z",
          objective: "Investor demo",
          audience: "IC",
          internalOnly: "remove_me",
        },
        demoPlan: [
          {
            order: 1,
            route: "/admin/dashboard",
            talkingPoints: ["point"],
            references: ["remove_me"],
          },
        ],
        charts: [],
        checklist: [],
        provenanceFreshnessSummary: {
          planSource: "generate_demo_plan",
          chartSource: "generate_chart_spec",
          chartFreshness: [],
          generatedFrom: ["routes_index"],
          privateSourceIds: ["remove_me"],
        },
        secretToken: "should_not_leak",
      },
    } as never);

    const res = await POST(makeRequest(buildReadPayload()));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      toolId?: string;
      result?: { payload?: Record<string, unknown> };
    };
    const payload = body.result?.payload as
      | {
          metadata?: Record<string, unknown>;
          demoPlan?: Array<Record<string, unknown>>;
          provenanceFreshnessSummary?: Record<string, unknown>;
          secretToken?: string;
        }
      | undefined;

    expect(body.status).toBe("executed");
    expect(body.toolId).toBe("export_demo_pack");
    expect(payload?.metadata?.objective).toBe("Investor demo");
    expect(payload?.metadata).not.toHaveProperty("internalOnly");
    expect(payload?.demoPlan?.[0]).not.toHaveProperty("references");
    expect(payload?.provenanceFreshnessSummary).not.toHaveProperty("privateSourceIds");
    expect(payload).not.toHaveProperty("secretToken");
  });

  it("returns passthrough status=confirmation_required for write", async () => {
    mockExecuteAdminWriteTool.mockResolvedValue({
      status: "confirmation_required",
      toolId: "create_review_note_draft",
      confirmation: {
        token: "token_1",
        expiresAtIso: "2100-01-01T00:00:00.000Z",
        summary: "create_review_note_draft requires explicit confirmation",
      },
    } as never);

    const res = await POST(makeRequest(buildWritePayload()));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      confirmation?: { token?: string };
    };
    expect(body.status).toBe("confirmation_required");
    expect(body.confirmation?.token).toBe("token_1");
  });

  it("returns passthrough status=executed for confirmed write", async () => {
    mockExecuteAdminWriteTool.mockResolvedValue({
      status: "executed",
      toolId: "create_review_note_draft",
      result: {
        title: "REVIEW NOTE DRAFT CREATED",
        lines: ["- id: fb_1"],
        createdEntityId: "fb_1",
      },
    } as never);

    const res = await POST(
      makeRequest(buildWritePayload({ confirmedToken: "token_1" })),
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      status?: string;
      result?: { createdEntityId?: string };
    };
    expect(body.status).toBe("executed");
    expect(body.result?.createdEntityId).toBe("fb_1");
  });

  it.each([
    { error: "admin_write_confirmation_expired", status: 410, code: "expired" },
    { error: "admin_write_confirmation_mismatch", status: 409, code: "mismatch" },
  ])("maps confirmation error '$error' to $status", async ({ error, status, code }) => {
    mockExecuteAdminWriteTool.mockRejectedValueOnce(new Error(error));

    const res = await POST(
      makeRequest(buildWritePayload({ confirmedToken: "bad_token" })),
    );

    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({
      error: "Write confirmation rejected",
      code,
    });
  });

  it("records blocked telemetry when execute_read tool is not allowlisted", async () => {
    mockGetAllowedAdminReadTools.mockReturnValue([] as never);

    const res = await POST(makeRequest(buildReadPayload()));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Tool not allowed" });
    expect(mockAdminToolRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        id: expect.stringMatching(/^tool:turn_/),
        toolId: "export_demo_pack",
        toolKind: "read",
        mode: "admin",
        profile: "admin",
        status: "blocked",
        userId: "admin_1",
        confirmationTokenUsed: false,
        errorCode: "blocked",
        errorMessage: "read_tool_not_allowed",
      }),
    });
  });

  it("records blocked telemetry when write tool is not allowlisted", async () => {
    mockGetAllowedAdminWriteTools.mockReturnValue([] as never);

    const res = await POST(
      makeRequest(buildWritePayload({ confirmedToken: "token_used" })),
    );

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Tool not allowed" });
    expect(mockAdminToolRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        status: "blocked",
        userId: "admin_1",
        confirmationTokenUsed: true,
        errorCode: "blocked",
        errorMessage: "write_tool_not_allowed",
      }),
    });
  });

  it("records blocked telemetry when write executor rejects with not-allowed", async () => {
    mockExecuteAdminWriteTool.mockRejectedValueOnce(
      new Error("admin_write_tool_not_allowed"),
    );

    const res = await POST(makeRequest(buildWritePayload()));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "Tool not allowed" });
    expect(mockAdminToolRunCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        toolId: "create_review_note_draft",
        toolKind: "write",
        status: "blocked",
        userId: "admin_1",
        confirmationTokenUsed: false,
        errorCode: "blocked",
        errorMessage: "write_tool_not_allowed",
      }),
    });
  });
});
