"use server";

import "server-only";

import { z } from "zod";

import { prisma } from "@/lib/db";
import { requireAuth } from "@/lib/auth/require-auth";
import { DEFAULT_VIEWS } from "./templates";
import type { ViewScope, ViewVisibility, ViewFilters, ViewSort } from "./templates";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const ScopeEnum = z.enum([
  "vaults",
  "distributions",
  "proofs",
  "investors",
  "signers",
  "memos",
  "events",
] as [ViewScope, ...ViewScope[]]);

const VisibilityEnum = z.enum(["private", "team"] as [ViewVisibility, ...ViewVisibility[]]);

const CreateViewSchema = z.object({
  scope: ScopeEnum,
  name: z.string().min(1).max(120),
  filters: z.record(z.string(), z.unknown()),
  sort: z
    .object({ field: z.string(), direction: z.enum(["asc", "desc"] as ["asc", "desc"]) })
    .optional(),
  columns: z.array(z.string()).optional(),
  visibility: VisibilityEnum.default("private"),
});

const UpdateViewSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  filters: z.record(z.string(), z.unknown()).optional(),
  sort: z
    .object({ field: z.string(), direction: z.enum(["asc", "desc"] as ["asc", "desc"]) })
    .optional()
    .nullable(),
  columns: z.array(z.string()).optional().nullable(),
  visibility: VisibilityEnum.optional(),
});

// ---------------------------------------------------------------------------
// Types (exported so UI can import them without depending on Prisma directly)
// ---------------------------------------------------------------------------

export interface SavedViewRow {
  id: string;
  userId: string;
  name: string;
  scope: ViewScope;
  filters: ViewFilters;
  sort: ViewSort | null;
  columns: string[] | null;
  visibility: ViewVisibility;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseJson<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function hydrateRow(row: {
  id: string;
  userId: string;
  name: string;
  scope: string;
  filters: string;
  sort: string | null;
  columns: string | null;
  visibility: string;
  createdAt: Date;
  updatedAt: Date;
}): SavedViewRow {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    scope: row.scope as ViewScope,
    filters: (parseJson<ViewFilters>(row.filters) ?? {}) as ViewFilters,
    sort: parseJson<ViewSort>(row.sort),
    columns: parseJson<string[]>(row.columns),
    visibility: row.visibility as ViewVisibility,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// CRUD actions
// ---------------------------------------------------------------------------

/**
 * Create a new saved view for the authenticated user.
 * userId is resolved from the server session — never accepted from the client.
 */
export async function createView(
  scope: ViewScope,
  name: string,
  filters: ViewFilters,
  sort?: ViewSort,
  columns?: string[],
  visibility: ViewVisibility = "private",
): Promise<SavedViewRow> {
  const { userId } = await requireAuth();

  const parsed = CreateViewSchema.parse({
    scope,
    name,
    filters,
    sort,
    columns,
    visibility,
  });

  const row = await prisma.savedView.create({
    data: {
      userId,
      name: parsed.name,
      scope: parsed.scope,
      filters: JSON.stringify(parsed.filters),
      sort: parsed.sort ? JSON.stringify(parsed.sort) : null,
      columns: parsed.columns ? JSON.stringify(parsed.columns) : null,
      visibility: parsed.visibility,
    },
  });

  return hydrateRow(row);
}

/**
 * Update an existing saved view (partial — only supplied fields are changed).
 * Ownership is verified: only the authenticated owner can mutate their view.
 */
export async function updateView(
  id: string,
  partial: {
    name?: string;
    filters?: ViewFilters;
    sort?: ViewSort | null;
    columns?: string[] | null;
    visibility?: ViewVisibility;
  },
): Promise<SavedViewRow> {
  const { userId } = await requireAuth();
  const parsed = UpdateViewSchema.parse(partial);

  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.filters !== undefined) data.filters = JSON.stringify(parsed.filters);
  if ("sort" in parsed) {
    data.sort = parsed.sort ? JSON.stringify(parsed.sort) : null;
  }
  if ("columns" in parsed) {
    data.columns = parsed.columns ? JSON.stringify(parsed.columns) : null;
  }
  if (parsed.visibility !== undefined) data.visibility = parsed.visibility;

  // updateMany scoped by both id AND userId; count===0 means not found or not owned.
  const { count } = await prisma.savedView.updateMany({
    where: { id, userId },
    data,
  });

  if (count === 0) {
    throw new Error("View not found or access denied");
  }

  // Re-fetch to return the hydrated row (updateMany does not return records).
  const row = await prisma.savedView.findUniqueOrThrow({ where: { id } });
  return hydrateRow(row);
}

/**
 * Delete a saved view by id.
 * Ownership is verified: only the authenticated owner can delete their view.
 */
export async function deleteView(id: string): Promise<void> {
  const { userId } = await requireAuth();

  // deleteMany scoped by both id AND userId; count===0 means not found or not owned.
  const { count } = await prisma.savedView.deleteMany({
    where: { id, userId },
  });

  if (count === 0) {
    throw new Error("View not found or access denied");
  }
}

/**
 * Load all saved views for the authenticated user, optionally filtered by scope.
 * userId is resolved from the server session — never accepted from the client.
 */
export async function loadUserViews(scope?: ViewScope): Promise<SavedViewRow[]> {
  const { userId } = await requireAuth();

  const rows = await prisma.savedView.findMany({
    where: scope ? { userId, scope } : { userId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map(hydrateRow);
}

/**
 * Seed the 8 default view templates for the authenticated user if they have none.
 * Idempotent — running it a second time is a no-op.
 * userId is resolved from the server session — never accepted from the client.
 */
export async function seedDefaults(): Promise<void> {
  const { userId } = await requireAuth();

  const existing = await prisma.savedView.count({ where: { userId } });
  if (existing > 0) return;

  await prisma.savedView.createMany({
    data: DEFAULT_VIEWS.map((tpl) => ({
      userId,
      name: tpl.name,
      scope: tpl.scope,
      filters: JSON.stringify(tpl.filters),
      sort: tpl.sort ? JSON.stringify(tpl.sort) : null,
      columns: tpl.columns ? JSON.stringify(tpl.columns) : null,
      visibility: tpl.visibility,
    })),
  });
}
