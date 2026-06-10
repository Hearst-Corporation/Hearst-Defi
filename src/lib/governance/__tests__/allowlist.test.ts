/**
 * Unit tests for src/lib/governance/allowlist.ts
 *
 * Mock strategy:
 * • requireAdmin               — vi.mock'd, controlled per test
 * • prisma.*                   — vi.mock'd
 * • recordAdminAudit / logger  — silenced
 * • revalidatePath             — silenced
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/require-admin", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    addressAllowlist: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/admin/audit", () => ({
  recordAdminAudit: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

// ── Imports ────────────────────────────────────────────────────────────────

import { requireAdmin } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  addAllowlistEntry,
  updateAllowlistEntry,
  deactivateAllowlistEntry,
  getAllAllowlistEntries,
  getActiveAllowlistEntries,
  findAllowlistEntryByAddress,
} from "../allowlist";

// ── Typed mock accessors ───────────────────────────────────────────────────

function allowlistMock() {
  return vi.mocked(prisma.addressAllowlist);
}

// ── Constants ──────────────────────────────────────────────────────────────

const ADMIN_USER = { userId: "0xAdminWallet", walletAddress: "0xAdminWallet" };

const RAW_ENTRY = {
  id: "entry_cuid_001",
  address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
  label: "Coinbase Custody Vault",
  category: "custody",
  addedBy: "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef",
  addedAt: new Date("2026-01-01T00:00:00Z"),
  notes: null,
  riskScore: 5,
  active: true,
};

// ── beforeEach ─────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireAdmin).mockResolvedValue(ADMIN_USER);
});

// ── addAllowlistEntry ──────────────────────────────────────────────────────

describe("addAllowlistEntry", () => {
  it("creates an entry and returns the mapped row", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().create as any).mockResolvedValue(RAW_ENTRY);

    const result = await addAllowlistEntry({
      address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
      label: "Coinbase Custody Vault",
      category: "custody",
      riskScore: 5,
    });

    expect(allowlistMock().create).toHaveBeenCalledOnce();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (allowlistMock().create as any).mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(createCall.data.active).toBe(true);
    expect(createCall.data.addedBy).toBe(ADMIN_USER.userId);
    expect(result.entry.category).toBe("custody");
    expect(result.entry.label).toBe("Coinbase Custody Vault");
  });

  it("rejects an invalid EVM address", async () => {
    await expect(
      addAllowlistEntry({
        address: "not-an-address",
        label: "Bad entry",
        category: "internal",
      }),
    ).rejects.toThrow("valid EVM address");
  });

  it("rejects a label over 200 chars", async () => {
    await expect(
      addAllowlistEntry({
        address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
        label: "a".repeat(201),
        category: "operations",
      }),
    ).rejects.toThrow();
  });

  it("rejects riskScore > 100", async () => {
    await expect(
      addAllowlistEntry({
        address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
        label: "Test",
        category: "counterparty",
        riskScore: 101,
      }),
    ).rejects.toThrow();
  });

  it("requires admin", async () => {
    vi.mocked(requireAdmin).mockRejectedValue(new Error("Admin access required."));

    await expect(
      addAllowlistEntry({
        address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
        label: "X",
        category: "internal",
      }),
    ).rejects.toThrow("Admin access required.");
  });
});

// ── updateAllowlistEntry ───────────────────────────────────────────────────

describe("updateAllowlistEntry", () => {
  it("updates specified fields and returns the new row", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findUnique as any).mockResolvedValue(RAW_ENTRY);
    const updated = { ...RAW_ENTRY, label: "Coinbase Prime", riskScore: 10 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().update as any).mockResolvedValue(updated);

    const result = await updateAllowlistEntry({
      id: "entry_cuid_001",
      label: "Coinbase Prime",
      riskScore: 10,
    });

    expect(allowlistMock().update).toHaveBeenCalledOnce();
    expect(result.entry.label).toBe("Coinbase Prime");
    expect(result.entry.riskScore).toBe(10);
  });

  it("deactivates an entry when active=false is passed", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findUnique as any).mockResolvedValue(RAW_ENTRY);
    const deactivated = { ...RAW_ENTRY, active: false };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().update as any).mockResolvedValue(deactivated);

    const result = await updateAllowlistEntry({ id: "entry_cuid_001", active: false });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (allowlistMock().update as any).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
      data: Record<string, unknown>;
    };
    expect(updateCall.data.active).toBe(false);
    expect(result.entry.active).toBe(false);
  });

  it("throws when entry not found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findUnique as any).mockResolvedValue(null);

    await expect(
      updateAllowlistEntry({ id: "nonexistent", active: false }),
    ).rejects.toThrow("Allowlist entry not found");
  });
});

// ── deactivateAllowlistEntry ───────────────────────────────────────────────

describe("deactivateAllowlistEntry", () => {
  it("calls updateAllowlistEntry with active=false", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findUnique as any).mockResolvedValue(RAW_ENTRY);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().update as any).mockResolvedValue({ ...RAW_ENTRY, active: false });

    await deactivateAllowlistEntry("entry_cuid_001");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateCall = (allowlistMock().update as any).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.active).toBe(false);
  });
});

// ── getAllAllowlistEntries ──────────────────────────────────────────────────

describe("getAllAllowlistEntries", () => {
  it("returns all entries (active + inactive)", async () => {
    const inactive = { ...RAW_ENTRY, id: "entry_002", active: false, label: "Old entry" };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findMany as any).mockResolvedValue([RAW_ENTRY, inactive]);

    const rows = await getAllAllowlistEntries();

    expect(rows).toHaveLength(2);
    expect(rows[0]!.active).toBe(true);
    expect(rows[1]!.active).toBe(false);
  });
});

// ── getActiveAllowlistEntries ──────────────────────────────────────────────

describe("getActiveAllowlistEntries", () => {
  it("returns only active entries (no admin check required)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findMany as any).mockResolvedValue([RAW_ENTRY]);

    const rows = await getActiveAllowlistEntries();

    expect(rows).toHaveLength(1);
    expect(rows[0]!.active).toBe(true);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findCall = (allowlistMock().findMany as any).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findCall.where.active).toBe(true);
  });
});

// ── findAllowlistEntryByAddress ────────────────────────────────────────────

describe("findAllowlistEntryByAddress", () => {
  it("returns the entry when found", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findFirst as any).mockResolvedValue(RAW_ENTRY);

    const entry = await findAllowlistEntryByAddress(
      "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
    );

    expect(entry).not.toBeNull();
    expect(entry!.label).toBe("Coinbase Custody Vault");
  });

  it("returns null when address is not on the list", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findFirst as any).mockResolvedValue(null);

    const entry = await findAllowlistEntryByAddress(
      "0xDeadBeefDeadBeefDeadBeefDeadBeefDeadBeef",
    );

    expect(entry).toBeNull();
  });

  it("scoped to active=true entries only", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findFirst as any).mockResolvedValue(null);

    await findAllowlistEntryByAddress("0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findCall = (allowlistMock().findFirst as any).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findCall.where.active).toBe(true);
  });

  it("normalises the lookup address to lowercase (checksummed vs lowercase match)", async () => {
    // Stored as lowercase (enforced by addAllowlistEntry); lookup with checksummed
    // mixed-case address must still find it.
    const storedLower = {
      ...RAW_ENTRY,
      address: "0xc0ffeebabec0ffeebabec0ffeebabec0ffeebabe",
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().findFirst as any).mockResolvedValue(storedLower);

    // Pass checksummed / mixed-case variant
    const entry = await findAllowlistEntryByAddress(
      "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
    );

    expect(entry).not.toBeNull();

    // Verify the query was issued with a lowercase address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const findCall = (allowlistMock().findFirst as any).mock.calls[0]?.[0] as {
      where: Record<string, unknown>;
    };
    expect(findCall.where.address).toBe("0xc0ffeebabec0ffeebabec0ffeebabec0ffeebabe");
  });

  it("stores address as lowercase when adding (checksummed input normalised)", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (allowlistMock().create as any).mockResolvedValue({
      ...RAW_ENTRY,
      address: "0xc0ffeebabec0ffeebabec0ffeebabec0ffeebabe",
    });

    await addAllowlistEntry({
      address: "0xC0ffeeBabeC0ffeeBabeC0ffeeBabeC0ffeeBabe",
      label: "Custody Wallet",
      category: "custody",
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createCall = (allowlistMock().create as any).mock.calls[0]?.[0] as {
      data: Record<string, unknown>;
    };
    expect(createCall.data.address).toBe("0xc0ffeebabec0ffeebabec0ffeebabec0ffeebabe");
  });
});
