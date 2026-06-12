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

vi.mock("@/lib/llm/tools", () => ({
  ADMIN_READ_TOOL_IDS: ["read_runtime_capabilities"],
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
import {
  executeAdminWriteTool,
  getAllowedAdminReadTools,
  getAllowedAdminWriteTools,
} from "@/lib/llm/tools";

const mockRequireAdmin = vi.mocked(requireAdmin);
const mockGetAllowedAdminReadTools = vi.mocked(getAllowedAdminReadTools);
const mockGetAllowedAdminWriteTools = vi.mocked(getAllowedAdminWriteTools);
const mockExecuteAdminWriteTool = vi.mocked(executeAdminWriteTool);

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
});

describe("POST /api/admin/chat-tools", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockRequireAdmin.mockResolvedValue({ userId: "admin_1" });
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
});
