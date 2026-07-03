/**
 * Unit tests for src/app/admin/agents/actions.ts
 *
 * The three server actions manage AgentTemplate rows in the prod DB behind the
 * admin gate. These tests pin the P0 behaviours:
 *   - requireAdmin() runs FIRST on every action; if it throws (non-admin /
 *     unauthenticated) no DB write and no navigation happen.
 *   - FormData input is validated by Zod BEFORE any mutation; malformed input
 *     (missing label, unknown baseAgent) is REJECTED and never touches the DB.
 *   - systemAdditions is forbidden-words gated before write.
 *   - createAgentTemplate slugifies the label, resolves slug collisions, then
 *     creates the row, revalidates, and redirects to the list.
 *   - updateAgentTemplate updates by id, revalidates both paths, redirects.
 *   - setAgentTemplateArchived flips the archived flag (true / false) and
 *     revalidates; a missing id is rejected before any write.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (declared before module import) ────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    agentTemplate: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

// Present for pattern-consistency with the other admin action suites. The
// agents actions do not (yet) record an audit; we mock it so the module graph
// never reaches the real (server-only) implementation and assert it stays unused.
vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createAgentTemplate,
  updateAgentTemplate,
  setAgentTemplateArchived,
} from "../actions";

// ── Fixtures ───────────────────────────────────────────────────────────────────

const ADMIN = { userId: "admin_agents" } as const;

/** Build a valid create/update FormData with sane defaults + optional overrides. */
function buildFormData(
  overrides: Record<string, string | null> = {},
): FormData {
  const base: Record<string, string | null> = {
    label: "Concise Analyst",
    description: "A concise investor-facing analyst.",
    baseAgent: "cockpit-chat",
    tone: "concise",
    language: "en",
    verbosity: "medium",
    systemAdditions: "Always cite the assumptions.",
  };
  const merged = { ...base, ...overrides };
  const fd = new FormData();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== null) fd.set(k, v);
  }
  return fd;
}

function resetAdminSuccess(): void {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
  vi.mocked(recordAdminAudit).mockResolvedValue(undefined as never);
}

// ── createAgentTemplate ───────────────────────────────────────────────────────

describe("createAgentTemplate", () => {
  beforeEach(() => {
    resetAdminSuccess();
    // No existing template with the slug → first candidate is free.
    vi.mocked(prisma.agentTemplate.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.agentTemplate.create).mockResolvedValue({
      id: "tpl_1",
    } as never);
  });

  it("gates on requireAdmin BEFORE touching the DB", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Admin access required."),
    );

    await expect(createAgentTemplate(buildFormData())).rejects.toThrow(
      "Admin access required.",
    );

    expect(prisma.agentTemplate.findUnique).not.toHaveBeenCalled();
    expect(prisma.agentTemplate.create).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("slugifies the label and creates the row with the normalised fields", async () => {
    await createAgentTemplate(buildFormData());

    expect(prisma.agentTemplate.findUnique).toHaveBeenCalledWith({
      where: { slug: "concise-analyst" },
    });
    expect(prisma.agentTemplate.create).toHaveBeenCalledTimes(1);
    expect(prisma.agentTemplate.create).toHaveBeenCalledWith({
      data: {
        slug: "concise-analyst",
        label: "Concise Analyst",
        description: "A concise investor-facing analyst.",
        baseAgent: "cockpit-chat",
        tone: "concise",
        language: "en",
        verbosity: "medium",
        systemAdditions: "Always cite the assumptions.",
      },
    });
  });

  it("resolves a slug collision by appending -2 (then -3, …)", async () => {
    // First candidate slug is taken, second is free.
    vi.mocked(prisma.agentTemplate.findUnique)
      .mockResolvedValueOnce({ id: "existing" } as never)
      .mockResolvedValueOnce(null);

    await createAgentTemplate(buildFormData());

    const slugs = vi
      .mocked(prisma.agentTemplate.findUnique)
      .mock.calls.map((c) => (c[0] as { where: { slug: string } }).where.slug);
    expect(slugs).toEqual(["concise-analyst", "concise-analyst-2"]);
    expect(prisma.agentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: "concise-analyst-2" }),
      }),
    );
  });

  it("coerces empty optional fields to null on the created row", async () => {
    await createAgentTemplate(
      buildFormData({
        description: null,
        tone: null,
        language: null,
        verbosity: null,
        systemAdditions: null,
      }),
    );

    expect(prisma.agentTemplate.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: null,
        tone: null,
        language: null,
        verbosity: null,
        systemAdditions: null,
      }),
    });
  });

  it("revalidates the list and redirects after a successful create", async () => {
    await createAgentTemplate(buildFormData());

    expect(revalidatePath).toHaveBeenCalledWith("/admin/agents");
    expect(redirect).toHaveBeenCalledWith("/admin/agents");
  });

  it("does not record an admin audit (the agents actions do not audit)", async () => {
    await createAgentTemplate(buildFormData());
    expect(recordAdminAudit).not.toHaveBeenCalled();
  });

  // ── input validation ───────────────────────────────────────────────────────

  it("REJECTS a too-short label before any DB write", async () => {
    await expect(
      createAgentTemplate(buildFormData({ label: "A" })),
    ).rejects.toThrow("Invalid agent template input");

    expect(prisma.agentTemplate.findUnique).not.toHaveBeenCalled();
    expect(prisma.agentTemplate.create).not.toHaveBeenCalled();
  });

  it("REJECTS an unknown baseAgent before any DB write", async () => {
    await expect(
      createAgentTemplate(buildFormData({ baseAgent: "not-a-real-agent" })),
    ).rejects.toThrow("Invalid agent template input");

    expect(prisma.agentTemplate.create).not.toHaveBeenCalled();
  });

  it("REJECTS forbidden vocabulary in systemAdditions before any DB write", async () => {
    await expect(
      createAgentTemplate(
        buildFormData({
          systemAdditions: "This vault is risk-free and we guarantee returns.",
        }),
      ),
    ).rejects.toThrow();

    expect(prisma.agentTemplate.create).not.toHaveBeenCalled();
  });
});

// ── updateAgentTemplate ───────────────────────────────────────────────────────

describe("updateAgentTemplate", () => {
  beforeEach(() => {
    resetAdminSuccess();
    vi.mocked(prisma.agentTemplate.update).mockResolvedValue({
      id: "tpl_1",
    } as never);
  });

  it("gates on requireAdmin BEFORE mutating", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Authentication required. Please log in."),
    );

    await expect(
      updateAgentTemplate("tpl_1", buildFormData()),
    ).rejects.toThrow("Authentication required");

    expect(prisma.agentTemplate.update).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });

  it("updates the row by id with the parsed fields", async () => {
    await updateAgentTemplate("tpl_1", buildFormData({ label: "Renamed" }));

    expect(prisma.agentTemplate.update).toHaveBeenCalledTimes(1);
    expect(prisma.agentTemplate.update).toHaveBeenCalledWith({
      where: { id: "tpl_1" },
      data: {
        label: "Renamed",
        description: "A concise investor-facing analyst.",
        baseAgent: "cockpit-chat",
        tone: "concise",
        language: "en",
        verbosity: "medium",
        systemAdditions: "Always cite the assumptions.",
      },
    });
    // Update must NOT touch slug (slug is immutable on the update path).
    const arg = vi.mocked(prisma.agentTemplate.update).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).not.toHaveProperty("slug");
  });

  it("revalidates both the list and the detail path, then redirects", async () => {
    await updateAgentTemplate("tpl_1", buildFormData());

    expect(revalidatePath).toHaveBeenCalledWith("/admin/agents");
    expect(revalidatePath).toHaveBeenCalledWith("/admin/agents/tpl_1");
    expect(redirect).toHaveBeenCalledWith("/admin/agents");
  });

  it("REJECTS malformed input before mutating", async () => {
    await expect(
      updateAgentTemplate("tpl_1", buildFormData({ label: "" })),
    ).rejects.toThrow("Invalid agent template input");

    expect(prisma.agentTemplate.update).not.toHaveBeenCalled();
  });
});

// ── setAgentTemplateArchived ──────────────────────────────────────────────────

describe("setAgentTemplateArchived", () => {
  beforeEach(() => {
    resetAdminSuccess();
    vi.mocked(prisma.agentTemplate.update).mockResolvedValue({
      id: "tpl_1",
    } as never);
  });

  function archiveForm(id: string | null, archived: string | null): FormData {
    const fd = new FormData();
    if (id !== null) fd.set("id", id);
    if (archived !== null) fd.set("archived", archived);
    return fd;
  }

  it("gates on requireAdmin BEFORE mutating", async () => {
    vi.mocked(requireAdmin).mockRejectedValueOnce(
      new Error("Admin access required."),
    );

    await expect(
      setAgentTemplateArchived(archiveForm("tpl_1", "true")),
    ).rejects.toThrow("Admin access required.");

    expect(prisma.agentTemplate.update).not.toHaveBeenCalled();
  });

  it("archives (archived=true) and revalidates the list", async () => {
    await setAgentTemplateArchived(archiveForm("tpl_1", "true"));

    expect(prisma.agentTemplate.update).toHaveBeenCalledWith({
      where: { id: "tpl_1" },
      data: { archived: true },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/admin/agents");
  });

  it("un-archives when archived is anything other than the string 'true'", async () => {
    await setAgentTemplateArchived(archiveForm("tpl_1", "false"));

    expect(prisma.agentTemplate.update).toHaveBeenCalledWith({
      where: { id: "tpl_1" },
      data: { archived: false },
    });
  });

  it("REJECTS a missing id before any DB write", async () => {
    await expect(
      setAgentTemplateArchived(archiveForm(null, "true")),
    ).rejects.toThrow("Missing template id");

    expect(prisma.agentTemplate.update).not.toHaveBeenCalled();
  });
});
