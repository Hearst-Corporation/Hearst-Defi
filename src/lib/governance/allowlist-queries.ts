/**
 * allowlist-queries.ts — Read-only query helpers for the AddressAllowlist table.
 *
 * Intentionally NOT a "use server" file. These helpers are called server-side
 * by routeForTransaction() (and similar internal callers) and must NOT be
 * callable Server Actions — exposing them as actions would allow unauthenticated
 * callers to enumerate the allowlist via the Next.js action dispatcher.
 *
 * Mutations and admin-gated queries live in allowlist.ts ("use server").
 * No "any", no cross-project imports. Server-only (touches prisma).
 */

import "server-only";

import { prisma } from "@/lib/db";
import type { AllowlistEntry } from "./allowlist";

/**
 * Row mapper shared with allowlist.ts — exported so allowlist.ts can import
 * it and avoid duplication. Types are erased at runtime so the type-only import
 * of AllowlistEntry in this file does not create a circular runtime dependency.
 */
export function mapRow(row: {
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
    category: row.category as AllowlistEntry["category"],
  };
}

/**
 * Returns all active allowlist entries (for routing decisions).
 * Safe to call from server-side non-action code (e.g. routeForTransaction).
 * Does NOT require admin — it is an internal routing helper, not an admin action.
 */
export async function getActiveAllowlistEntries(): Promise<AllowlistEntry[]> {
  const rows = await prisma.addressAllowlist.findMany({
    where: { active: true },
    orderBy: [{ category: "asc" }, { label: "asc" }],
  });
  return rows.map(mapRow);
}

/**
 * Looks up a single entry by address. Both the lookup key and stored values
 * are normalised to lowercase, so checksummed / mixed-case EVM addresses
 * match regardless of how the caller formats them.
 * Does NOT require admin — it is an internal routing helper, not an admin action.
 */
export async function findAllowlistEntryByAddress(
  address: string,
): Promise<AllowlistEntry | null> {
  const row = await prisma.addressAllowlist.findFirst({
    where: { address: address.toLowerCase(), active: true },
  });
  return row ? mapRow(row) : null;
}
