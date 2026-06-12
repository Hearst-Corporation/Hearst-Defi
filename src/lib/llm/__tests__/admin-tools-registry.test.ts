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

import { prisma } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  prisma: {
    feedback: { create: vi.fn() },
    governanceProposal: { create: vi.fn() },
  },
}));

const mockFeedbackCreate = vi.mocked(prisma.feedback.create);
const mockGovernanceCreate = vi.mocked(prisma.governanceProposal.create);

describe("admin read tools policy", () => {
  beforeEach(() => {
    clearWriteConfirmationsForTests();
    vi.clearAllMocks();
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
  beforeEach(() => {
    clearWriteConfirmationsForTests();
    vi.clearAllMocks();
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
  });
});

describe("admin write tools policy and confirmation", () => {
  beforeEach(() => {
    clearWriteConfirmationsForTests();
    vi.clearAllMocks();
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

    await expect(
      executeAdminWriteTool(
        tool,
        context,
        { input, confirmedToken: token },
        { nowMs: 2_200, ttlMs: 10_000 },
      ),
    ).rejects.toThrow("admin_write_confirmation_used");
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
  });
});
