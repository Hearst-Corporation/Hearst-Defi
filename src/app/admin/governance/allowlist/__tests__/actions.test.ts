/**
 * Unit tests for src/app/admin/governance/allowlist/actions.ts — the Server
 * Action wrappers around the AddressAllowlist CRUD helpers.
 *
 * The wrappers parse FormData and delegate to addAllowlistEntry /
 * updateAllowlistEntry in src/lib/governance/allowlist.ts (imported REAL, not
 * mocked). Those helpers own the Zod validation, the prisma mutation and the
 * admin-audit record. So these tests exercise the full path:
 *   FormData → wrapper → requireAdmin gate → Zod parse → prisma mutate → audit.
 *
 * Mock strategy (factory form — hoisting-safe, no top-level closures captured):
 * • requireAdmin                  — vi.mock'd, controlled per test
 * • prisma.addressAllowlist.*     — vi.mock'd (create / findUnique / update)
 * • recordAdminAudit              — vi.mock'd (asserted)
 * • revalidatePath / logger       — silenced
 *
 * Covers: requireAdmin gating (blocks before any DB touch), input validation
 * (bad EVM address rejected by Zod), add / update / toggle mutating with the
 * correct data, and the admin audit being recorded on every mutation.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks (factory form) ─────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    addressAllowlist: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports (after mocks) ────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { recordAdminAudit } from "@/lib/admin/audit";
import {
  addAllowlistEntryAction,
  updateAllowlistEntryAction,
  toggleAllowlistEntryAction,
} from "../actions";

// ── Typed mock accessors ─────────────────────────────────────────────────

function allowlistMock() {
  return vi.mocked(prisma.addressAllowlist);
}

// ── Shared constants / fixtures ──────────────────────────────────────────

const ADMIN = { userId: "admin_user_1" };
const VALID_ADDRESS = "0x1111111111111111111111111111111111111111";
const ENTRY_ID = "allowlist_cuid_001";

type AllowlistRow = NonNullable<
  Awaited<ReturnType<typeof prisma.addressAllowlist.findUnique>>
>;

function baseRow(overrides: Partial<AllowlistRow> = {}): AllowlistRow {
  return {
    id: ENTRY_ID,
    address: VALID_ADDRESS,
    label: "Fireblocks custody",
    category: "custody",
    addedBy: ADMIN.userId,
    addedAt: new Date("2026-01-01T00:00:00Z"),
    notes: null,
    riskScore: 0,
    active: true,
    ...overrides,
  };
}

/** Builds a FormData from a plain record (values coerced to strings). */
function formOf(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

// ── beforeEach ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN);
});

// ── addAllowlistEntryAction ───────────────────────────────────────────────

describe("addAllowlistEntryAction", () => {
  it("requires admin — a non-admin caller never touches the DB", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      addAllowlistEntryAction(
        formOf({ address: VALID_ADDRESS, label: "X", category: "custody" }),
      ),
    ).rejects.toThrow("Admin access required.");

    expect(allowlistMock().create).not.toHaveBeenCalled();
    expect(vi.mocked(recordAdminAudit)).not.toHaveBeenCalled();
  });

  it("rejects an invalid EVM address (Zod validation) before writing", async () => {
    await expect(
      addAllowlistEntryAction(
        formOf({ address: "not-an-address", label: "X", category: "custody" }),
      ),
    ).rejects.toThrow();

    expect(allowlistMock().create).not.toHaveBeenCalled();
    expect(vi.mocked(recordAdminAudit)).not.toHaveBeenCalled();
  });

  it("rejects an invalid category (Zod enum) before writing", async () => {
    await expect(
      addAllowlistEntryAction(
        formOf({ address: VALID_ADDRESS, label: "X", category: "bogus" }),
      ),
    ).rejects.toThrow();

    expect(allowlistMock().create).not.toHaveBeenCalled();
  });

  it("creates the entry (address lowercased, riskScore parsed) and records an audit", async () => {
    const CHECKSUM_ADDR = "0xAbCdEf0000000000000000000000000000000001";
    const created = baseRow({
      address: CHECKSUM_ADDR.toLowerCase(),
      label: "Counterparty A",
      category: "counterparty",
      notes: "settlement wallet",
      riskScore: 42,
    });
    allowlistMock().create.mockResolvedValue(created);

    await addAllowlistEntryAction(
      formOf({
        address: CHECKSUM_ADDR,
        label: "Counterparty A",
        category: "counterparty",
        notes: "settlement wallet",
        riskScore: "42",
      }),
    );

    expect(allowlistMock().create).toHaveBeenCalledOnce();
    const arg = vi.mocked(allowlistMock().create).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data).toMatchObject({
      address: CHECKSUM_ADDR.toLowerCase(),
      label: "Counterparty A",
      category: "counterparty",
      addedBy: ADMIN.userId,
      notes: "settlement wallet",
      riskScore: 42,
      active: true,
    });

    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "allowlist.add",
        entityType: "AddressAllowlist",
        entityId: created.id,
      }),
    );
  });

  it("defaults riskScore to 0 when the field is empty/absent", async () => {
    allowlistMock().create.mockResolvedValue(baseRow());

    await addAllowlistEntryAction(
      formOf({ address: VALID_ADDRESS, label: "Ops wallet", category: "operations" }),
    );

    const arg = vi.mocked(allowlistMock().create).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.riskScore).toBe(0);
    expect(arg.data.notes).toBeNull();
  });
});

// ── updateAllowlistEntryAction ────────────────────────────────────────────

describe("updateAllowlistEntryAction", () => {
  it("requires admin before reading or writing", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      updateAllowlistEntryAction(formOf({ id: ENTRY_ID, label: "New" })),
    ).rejects.toThrow("Admin access required.");

    expect(allowlistMock().findUnique).not.toHaveBeenCalled();
    expect(allowlistMock().update).not.toHaveBeenCalled();
  });

  it("throws when the entry does not exist", async () => {
    allowlistMock().findUnique.mockResolvedValue(null);

    await expect(
      updateAllowlistEntryAction(formOf({ id: ENTRY_ID, label: "New" })),
    ).rejects.toThrow("Allowlist entry not found");

    expect(allowlistMock().update).not.toHaveBeenCalled();
    expect(vi.mocked(recordAdminAudit)).not.toHaveBeenCalled();
  });

  it("updates only the provided fields and records an audit", async () => {
    const existing = baseRow({ label: "Old label", riskScore: 10 });
    allowlistMock().findUnique.mockResolvedValue(existing);
    allowlistMock().update.mockResolvedValue(
      baseRow({ label: "Fresh label", riskScore: 77, notes: "rotated" }),
    );

    await updateAllowlistEntryAction(
      formOf({ id: ENTRY_ID, label: "Fresh label", notes: "rotated", riskScore: "77" }),
    );

    expect(allowlistMock().update).toHaveBeenCalledOnce();
    const arg = vi.mocked(allowlistMock().update).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(arg.where).toMatchObject({ id: ENTRY_ID });
    expect(arg.data).toMatchObject({
      label: "Fresh label",
      notes: "rotated",
      riskScore: 77,
    });
    // active was not supplied → not in the update payload.
    expect(arg.data.active).toBeUndefined();

    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledOnce();
    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "allowlist.update",
        entityType: "AddressAllowlist",
        entityId: ENTRY_ID,
      }),
    );
  });
});

// ── toggleAllowlistEntryAction ────────────────────────────────────────────

describe("toggleAllowlistEntryAction", () => {
  it("requires admin before touching the DB", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      toggleAllowlistEntryAction(formOf({ id: ENTRY_ID, active: "true" })),
    ).rejects.toThrow("Admin access required.");

    expect(allowlistMock().findUnique).not.toHaveBeenCalled();
    expect(allowlistMock().update).not.toHaveBeenCalled();
  });

  it("flips an active entry to inactive (active=true → update active:false)", async () => {
    allowlistMock().findUnique.mockResolvedValue(baseRow({ active: true }));
    allowlistMock().update.mockResolvedValue(baseRow({ active: false }));

    await toggleAllowlistEntryAction(formOf({ id: ENTRY_ID, active: "true" }));

    const arg = vi.mocked(allowlistMock().update).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.active).toBe(false);

    expect(vi.mocked(recordAdminAudit)).toHaveBeenCalledWith(
      expect.objectContaining({ action: "allowlist.update", entityId: ENTRY_ID }),
    );
  });

  it("flips an inactive entry back to active (active!=='true' → update active:true)", async () => {
    allowlistMock().findUnique.mockResolvedValue(baseRow({ active: false }));
    allowlistMock().update.mockResolvedValue(baseRow({ active: true }));

    await toggleAllowlistEntryAction(formOf({ id: ENTRY_ID, active: "false" }));

    const arg = vi.mocked(allowlistMock().update).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(arg.data.active).toBe(true);
  });
});
