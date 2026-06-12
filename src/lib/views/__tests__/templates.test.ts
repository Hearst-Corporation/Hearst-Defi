import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server-only so tests can import server modules
vi.mock("server-only", () => ({}));

// Mock requireAuth so tests never need a real session
vi.mock("@/lib/auth/require-auth", () => ({
  requireAuth: vi.fn().mockResolvedValue({ userId: "user_aaa" }),
}));

// Mock prisma before importing modules that touch it
vi.mock("@/lib/db", () => ({
  prisma: {
    savedView: {
      create: vi.fn(),
      createMany: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      count: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";
import {
  createView,
  updateView,
  deleteView,
  loadUserViews,
  seedDefaults,
  type SavedViewRow,
} from "../actions";
import { DEFAULT_VIEWS, DEFAULT_VIEW_COUNT } from "../templates";

const USER_A = "user_aaa";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Partial<SavedViewRow> = {}): SavedViewRow {
  const now = new Date("2026-01-01T00:00:00Z");
  return {
    id: "clxabc123",
    userId: USER_A,
    name: "My view",
    scope: "vaults",
    filters: {},
    sort: null,
    columns: null,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeDbRow(row: SavedViewRow) {
  return {
    ...row,
    filters: JSON.stringify(row.filters),
    sort: row.sort ? JSON.stringify(row.sort) : null,
    columns: row.columns ? JSON.stringify(row.columns) : null,
  };
}

// ---------------------------------------------------------------------------
// Templates shape tests (pure, no DB)
// ---------------------------------------------------------------------------

describe("DEFAULT_VIEWS", () => {
  it("exports exactly 8 templates", () => {
    expect(DEFAULT_VIEWS).toHaveLength(8);
    expect(DEFAULT_VIEW_COUNT).toBe(8);
  });

  it("every template has a non-empty name and valid scope", () => {
    const validScopes = new Set([
      "vaults",
      "distributions",
      "proofs",
      "investors",
      "signers",
      "memos",
      "events",
    ]);
    for (const tpl of DEFAULT_VIEWS) {
      expect(tpl.name.length).toBeGreaterThan(0);
      expect(validScopes.has(tpl.scope)).toBe(true);
    }
  });

  it("every template has a non-empty filters object", () => {
    for (const tpl of DEFAULT_VIEWS) {
      expect(typeof tpl.filters).toBe("object");
      expect(Object.keys(tpl.filters).length).toBeGreaterThan(0);
    }
  });
});

// ---------------------------------------------------------------------------
// seedDefaults — idempotence tests
// ---------------------------------------------------------------------------

describe("seedDefaults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates 8 views when user has none", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.count).mockResolvedValue(0);
    vi.mocked(prisma.savedView.createMany).mockResolvedValue({ count: 8 });

    await seedDefaults();

    expect(prisma.savedView.createMany).toHaveBeenCalledOnce();
    const call = vi.mocked(prisma.savedView.createMany).mock.calls[0]![0]!;
    expect(call.data).toHaveLength(8);
    // All rows belong to the user resolved from session
    for (const row of call.data as Array<{ userId: string }>) {
      expect(row.userId).toBe(USER_A);
    }
  });

  it("is idempotent — does nothing when user already has views", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.count).mockResolvedValue(8);

    await seedDefaults();

    expect(prisma.savedView.createMany).not.toHaveBeenCalled();
  });

  it("still no-ops when user has partial views (e.g. 3)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.count).mockResolvedValue(3);

    await seedDefaults();

    expect(prisma.savedView.createMany).not.toHaveBeenCalled();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Authentication required. Please log in."));

    await expect(seedDefaults()).rejects.toThrow("Authentication required");
  });
});

// ---------------------------------------------------------------------------
// createView
// ---------------------------------------------------------------------------

describe("createView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists the row and returns a hydrated SavedViewRow", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const filters = { health: { ne: "healthy" } };
    const raw = makeDbRow(makeRow({ filters, scope: "vaults", name: "Bad vaults" }));
    vi.mocked(prisma.savedView.create).mockResolvedValue(raw);

    const result = await createView("vaults", "Bad vaults", filters);

    expect(prisma.savedView.create).toHaveBeenCalledOnce();
    const createCall = vi.mocked(prisma.savedView.create).mock.calls[0]![0]!;
    // userId must come from session, not from a parameter
    expect(createCall.data.userId).toBe(USER_A);
    expect(result.name).toBe("Bad vaults");
    expect(result.scope).toBe("vaults");
    expect(result.filters).toEqual(filters);
    expect(result.visibility).toBe("private");
  });

  it("serializes sort and columns to JSON when provided", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const filters = { status: "live" };
    const sort = { field: "aumUsdc", direction: "desc" as const };
    const columns = ["name", "aumUsdc", "apy"];
    const raw = makeDbRow(makeRow({ filters, sort, columns }));
    vi.mocked(prisma.savedView.create).mockResolvedValue(raw);

    const result = await createView("vaults", "My view", filters, sort, columns);

    const createCall = vi.mocked(prisma.savedView.create).mock.calls[0]![0]!;
    expect(JSON.parse(createCall.data.sort as string)).toEqual(sort);
    expect(JSON.parse(createCall.data.columns as string)).toEqual(columns);
    expect(result.sort).toEqual(sort);
    expect(result.columns).toEqual(columns);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Authentication required. Please log in."));

    await expect(createView("vaults", "My view", {})).rejects.toThrow("Authentication required");
  });
});

// ---------------------------------------------------------------------------
// updateView
// ---------------------------------------------------------------------------

describe("updateView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("merges only supplied fields and scopes by userId", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const original = makeRow({ name: "Original", visibility: "private" });
    const updated = makeDbRow({ ...original, name: "Renamed" });
    vi.mocked(prisma.savedView.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.savedView.findUniqueOrThrow).mockResolvedValue(updated);

    const result = await updateView(original.id, { name: "Renamed" });

    const call = vi.mocked(prisma.savedView.updateMany).mock.calls[0]![0]!;
    // Must scope by both id and userId (ownership check)
    expect(call.where).toEqual({ id: original.id, userId: USER_A });
    expect(call.data.name).toBe("Renamed");
    // visibility was NOT supplied — should not be in data
    expect(call.data.visibility).toBeUndefined();
    expect(result.name).toBe("Renamed");
  });

  it("throws when the view is not found or not owned (count===0)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.updateMany).mockResolvedValue({ count: 0 });

    await expect(updateView("nonexistent-id", { name: "Rename" })).rejects.toThrow(
      "View not found or access denied",
    );
  });

  it("allows clearing sort to null", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const original = makeRow({ sort: { field: "aumUsdc", direction: "desc" } });
    const updated = makeDbRow({ ...original, sort: null });
    vi.mocked(prisma.savedView.updateMany).mockResolvedValue({ count: 1 });
    vi.mocked(prisma.savedView.findUniqueOrThrow).mockResolvedValue(updated);

    await updateView(original.id, { sort: null });

    const call = vi.mocked(prisma.savedView.updateMany).mock.calls[0]![0]!;
    expect(call.data.sort).toBeNull();
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Authentication required. Please log in."));

    await expect(updateView("some-id", { name: "New name" })).rejects.toThrow(
      "Authentication required",
    );
  });
});

// ---------------------------------------------------------------------------
// deleteView
// ---------------------------------------------------------------------------

describe("deleteView", () => {
  beforeEach(() => vi.clearAllMocks());

  it("calls prisma.savedView.deleteMany with id and userId (ownership check)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.deleteMany).mockResolvedValue({ count: 1 });

    await deleteView("clxabc123");

    expect(prisma.savedView.deleteMany).toHaveBeenCalledWith({
      where: { id: "clxabc123", userId: USER_A },
    });
  });

  it("throws when the view is not found or not owned (count===0)", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    vi.mocked(prisma.savedView.deleteMany).mockResolvedValue({ count: 0 });

    await expect(deleteView("nonexistent-id")).rejects.toThrow(
      "View not found or access denied",
    );
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Authentication required. Please log in."));

    await expect(deleteView("clxabc123")).rejects.toThrow("Authentication required");
  });
});

// ---------------------------------------------------------------------------
// loadUserViews
// ---------------------------------------------------------------------------

describe("loadUserViews", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all views for user when no scope filter", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const rows = [
      makeDbRow(makeRow({ scope: "vaults" })),
      makeDbRow(makeRow({ id: "clxabc456", scope: "investors" })),
    ];
    vi.mocked(prisma.savedView.findMany).mockResolvedValue(rows);

    const result = await loadUserViews();

    expect(result).toHaveLength(2);
    const call = vi.mocked(prisma.savedView.findMany).mock.calls[0]![0]!;
    expect(call.where).toEqual({ userId: USER_A });
  });

  it("filters by scope when provided", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const rows = [makeDbRow(makeRow({ scope: "vaults" }))];
    vi.mocked(prisma.savedView.findMany).mockResolvedValue(rows);

    const result = await loadUserViews("vaults");

    expect(result).toHaveLength(1);
    expect(result[0]!.scope).toBe("vaults");
    const call = vi.mocked(prisma.savedView.findMany).mock.calls[0]![0]!;
    expect(call.where).toEqual({ userId: USER_A, scope: "vaults" });
  });

  it("hydrates JSON fields back to objects", async () => {
    vi.mocked(requireAuth).mockResolvedValue({ userId: USER_A });
    const filters = { status: "live", oracle_stale: true };
    const sort = { field: "aumUsdc", direction: "asc" as const };
    const columns = ["name", "apy"];
    const row = makeDbRow(makeRow({ filters, sort, columns }));
    vi.mocked(prisma.savedView.findMany).mockResolvedValue([row]);

    const [result] = await loadUserViews();

    expect(result!.filters).toEqual(filters);
    expect(result!.sort).toEqual(sort);
    expect(result!.columns).toEqual(columns);
  });

  it("throws when unauthenticated", async () => {
    vi.mocked(requireAuth).mockRejectedValue(new Error("Authentication required. Please log in."));

    await expect(loadUserViews()).rejects.toThrow("Authentication required");
  });
});
