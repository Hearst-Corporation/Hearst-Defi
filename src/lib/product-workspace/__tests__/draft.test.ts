import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn() },
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    vaultDraft: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  loadProductWorkspaceDraft,
  upsertProductWorkspaceDraft,
} from "@/lib/product-workspace/draft";

const mockFindUnique = vi.mocked(prisma.vaultDraft.findUnique);
const mockUpsert = vi.mocked(prisma.vaultDraft.upsert);

describe("product workspace draft persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores Product Workspace state inside the existing per-admin draft row", async () => {
    mockFindUnique.mockResolvedValue({
      id: "draft-1",
      userId: "admin-1",
      formState: JSON.stringify({ ticker: "HYV-A" }),
      step: "identity",
      updatedAt: new Date("2026-06-13T00:00:00.000Z"),
      createdAt: new Date("2026-06-12T00:00:00.000Z"),
    } as never);
    mockUpsert.mockResolvedValue({} as never);

    const result = await upsertProductWorkspaceDraft({
      userId: "admin-1",
      objective: "Créer un produit Defensive",
      vaultTicker: "HDV",
      vaultLabel: "Hearst Defensive Vault",
      intentKind: "product_creation",
      scenarioValidationQueued: false,
      now: new Date("2026-06-13T01:02:03.000Z"),
    });

    expect(result).toEqual({
      objective: "Créer un produit Defensive",
      vaultTicker: "HDV",
      vaultLabel: "Hearst Defensive Vault",
      intentKind: "product_creation",
      scenarioValidationQueued: false,
      updatedAtIso: "2026-06-13T01:02:03.000Z",
    });
    expect(mockUpsert).toHaveBeenCalledWith({
      where: { userId: "admin-1" },
      create: expect.objectContaining({
        userId: "admin-1",
        step: "product-workspace",
      }),
      update: expect.objectContaining({
        step: "identity",
      }),
    });
    const update = mockUpsert.mock.calls[0]?.[0].update;
    expect(JSON.parse(String(update?.formState))).toMatchObject({
      ticker: "HYV-A",
      productWorkspace: {
        vaultTicker: "HDV",
        vaultLabel: "Hearst Defensive Vault",
      },
    });
  });

  it("loads a persisted Product Workspace draft when present", async () => {
    mockFindUnique.mockResolvedValue({
      formState: JSON.stringify({
        productWorkspace: {
          objective: "Frame BTC Plus",
          vaultTicker: "HBP",
          vaultLabel: "Hearst BTC Plus Vault",
          scenarioValidationQueued: true,
          updatedAtIso: "2026-06-13T01:02:03.000Z",
        },
      }),
    } as never);

    await expect(loadProductWorkspaceDraft("admin-1")).resolves.toEqual({
      objective: "Frame BTC Plus",
      vaultTicker: "HBP",
      vaultLabel: "Hearst BTC Plus Vault",
      scenarioValidationQueued: true,
      updatedAtIso: "2026-06-13T01:02:03.000Z",
    });
  });

  it("stores agentBrief when supplied to upsert", async () => {
    mockFindUnique.mockResolvedValue(null as never);
    mockUpsert.mockResolvedValue({} as never);

    const result = await upsertProductWorkspaceDraft({
      userId: "admin-1",
      objective: "Créer un vault Defensive",
      vaultTicker: "HDV",
      vaultLabel: "Hearst Defensive Vault",
      scenarioValidationQueued: false,
      agentBrief: "Brief de cadrage complet.",
      now: new Date("2026-06-17T00:00:00.000Z"),
    });

    expect(result?.agentBrief).toBe("Brief de cadrage complet.");
  });

  it("preserves an existing agentBrief on the SAME objective when none is supplied", async () => {
    mockFindUnique.mockResolvedValue({
      formState: JSON.stringify({
        productWorkspace: {
          objective: "Créer un vault Defensive",
          vaultTicker: "HDV",
          vaultLabel: "Hearst Defensive Vault",
          agentBrief: "Brief écrit par l'agent.",
          scenarioValidationQueued: false,
          updatedAtIso: "2026-06-17T00:00:00.000Z",
        },
      }),
    } as never);
    mockUpsert.mockResolvedValue({} as never);

    // The page re-seeds the same objective on render WITHOUT a brief — it must
    // not wipe the brief the route attached in between.
    const result = await upsertProductWorkspaceDraft({
      userId: "admin-1",
      objective: "Créer un vault Defensive",
      vaultTicker: "HDV",
      vaultLabel: "Hearst Defensive Vault",
      scenarioValidationQueued: false,
      now: new Date("2026-06-17T01:00:00.000Z"),
    });

    expect(result?.agentBrief).toBe("Brief écrit par l'agent.");
  });

  it("drops a stale agentBrief when the objective changes", async () => {
    mockFindUnique.mockResolvedValue({
      formState: JSON.stringify({
        productWorkspace: {
          objective: "Ancien produit",
          vaultTicker: "HYV",
          vaultLabel: "Hearst Yield Vault",
          agentBrief: "Brief de l'ancien produit.",
          scenarioValidationQueued: false,
          updatedAtIso: "2026-06-17T00:00:00.000Z",
        },
      }),
    } as never);
    mockUpsert.mockResolvedValue({} as never);

    const result = await upsertProductWorkspaceDraft({
      userId: "admin-1",
      objective: "Nouveau produit BTC Plus",
      vaultTicker: "HBP",
      vaultLabel: "Hearst BTC Plus Vault",
      scenarioValidationQueued: false,
      now: new Date("2026-06-17T02:00:00.000Z"),
    });

    expect(result?.agentBrief).toBeUndefined();
  });
});
