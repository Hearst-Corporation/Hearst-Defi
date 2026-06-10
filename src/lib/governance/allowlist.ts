/**
 * allowlist.ts — CRUD helpers for the AddressAllowlist table.
 *
 * All mutations are "use server" actions (called from admin UI or Server
 * Actions wrappers). Pure query helpers are also exported for use in
 * routeForTransaction() (server-side, no "use server" needed there).
 *
 * No "any", no cross-project imports. Server-only (touches prisma).
 */

"use server";

import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { recordAdminAudit } from "@/lib/admin/audit";
import { logger } from "@/lib/logger";
import { revalidatePath } from "next/cache";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AllowlistCategory =
  | "custody"
  | "counterparty"
  | "operations"
  | "internal";

export interface AllowlistEntry {
  id: string;
  address: string;
  label: string;
  category: AllowlistCategory;
  addedBy: string;
  addedAt: Date;
  notes: string | null;
  riskScore: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const CATEGORIES = ["custody", "counterparty", "operations", "internal"] as const;

const AddSchema = z.object({
  address: z.string().min(1).regex(/^0x[0-9a-fA-F]{40}$/, "Must be a valid EVM address (0x…)"),
  label: z.string().min(1).max(200),
  category: z.enum(CATEGORIES),
  notes: z.string().max(500).optional(),
  riskScore: z.number().int().min(0).max(100).default(0),
});

const UpdateSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  notes: z.string().max(500).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mapRow(row: {
  id: string;
  address: string;
  label: string;
  category: string;
  addedBy: string;
  addedAt: Date;
  notes: string | null;
  riskScore: number;
  active: boolean;
}): AllowlistEntry {
  return {
    ...row,
    category: row.category as AllowlistCategory,
  };
}

// ---------------------------------------------------------------------------
// Queries (no "use server" individually — file-level directive covers them)
// ---------------------------------------------------------------------------

/**
 * Returns all active allowlist entries (for routing decisions).
 * Safe to call from server-side non-action code (e.g. routeForTransaction).
 */
export async function getActiveAllowlistEntries(): Promise<AllowlistEntry[]> {
  const rows = await prisma.addressAllowlist.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });
  return rows.map(mapRow);
}

/**
 * Returns all allowlist entries (active + inactive) for the admin UI.
 */
export async function getAllAllowlistEntries(): Promise<AllowlistEntry[]> {
  await requireAdmin();

  const rows = await prisma.addressAllowlist.findMany({
    orderBy: [{ active: "desc" }, { category: "asc" }, { label: "asc" }],
  });
  return rows.map(mapRow);
}

/**
 * Looks up a single entry by address. Both the lookup key and stored values
 * are normalised to lowercase, so checksummed / mixed-case EVM addresses
 * match regardless of how the caller formats them.
 */
export async function findAllowlistEntryByAddress(
  address: string,
): Promise<AllowlistEntry | null> {
  const row = await prisma.addressAllowlist.findFirst({
    where: { address: address.toLowerCase(), active: true },
  });
  return row ? mapRow(row) : null;
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface AllowlistAddResult {
  entry: AllowlistEntry;
}

/**
 * Adds a new address to the allowlist.
 * Throws if the address already exists (unique constraint).
 */
export async function addAllowlistEntry(input: {
  address: string;
  label: string;
  category: AllowlistCategory;
  notes?: string;
  riskScore?: number;
}): Promise<AllowlistAddResult> {
  const admin = await requireAdmin();
  const parsed = AddSchema.parse(input);

  const row = await prisma.addressAllowlist.create({
    data: {
      address: parsed.address.toLowerCase(),
      label: parsed.label,
      category: parsed.category,
      addedBy: admin.userId,
      notes: parsed.notes ?? null,
      riskScore: parsed.riskScore,
      active: true,
    },
  });

  await recordAdminAudit({
    actorWallet: admin.userId,
    action: "allowlist.add",
    entityType: "AddressAllowlist",
    entityId: row.id,
    before: null,
    after: { address: row.address, category: row.category, label: row.label },
  });

  logger.info("Allowlist entry added", { id: row.id, address: row.address });
  revalidatePath("/admin/governance/allowlist");

  return { entry: mapRow(row) };
}

export interface AllowlistUpdateResult {
  entry: AllowlistEntry;
}

/**
 * Updates a subset of fields on an existing allowlist entry.
 */
export async function updateAllowlistEntry(input: {
  id: string;
  label?: string;
  category?: AllowlistCategory;
  notes?: string;
  riskScore?: number;
  active?: boolean;
}): Promise<AllowlistUpdateResult> {
  const admin = await requireAdmin();
  const parsed = UpdateSchema.parse(input);

  const existing = await prisma.addressAllowlist.findUnique({
    where: { id: parsed.id },
  });
  if (!existing) throw new Error("Allowlist entry not found");

  const updateData: Partial<{
    label: string;
    category: string;
    notes: string | null;
    riskScore: number;
    active: boolean;
  }> = {};

  if (parsed.label !== undefined) updateData.label = parsed.label;
  if (parsed.category !== undefined) updateData.category = parsed.category;
  if (parsed.notes !== undefined) updateData.notes = parsed.notes;
  if (parsed.riskScore !== undefined) updateData.riskScore = parsed.riskScore;
  if (parsed.active !== undefined) updateData.active = parsed.active;

  const row = await prisma.addressAllowlist.update({
    where: { id: parsed.id },
    data: updateData,
  });

  await recordAdminAudit({
    actorWallet: admin.userId,
    action: "allowlist.update",
    entityType: "AddressAllowlist",
    entityId: row.id,
    before: {
      label: existing.label,
      category: existing.category,
      active: existing.active,
      riskScore: existing.riskScore,
    },
    after: { label: row.label, category: row.category, active: row.active, riskScore: row.riskScore },
  });

  logger.info("Allowlist entry updated", { id: row.id, active: row.active });
  revalidatePath("/admin/governance/allowlist");

  return { entry: mapRow(row) };
}

/**
 * Deactivates an entry (soft-delete). Active=false removes it from routing
 * decisions without destroying the audit trail.
 */
export async function deactivateAllowlistEntry(id: string): Promise<void> {
  await updateAllowlistEntry({ id, active: false });
}
