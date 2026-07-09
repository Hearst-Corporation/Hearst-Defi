import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withVaultCors, vaultCorsPreflight } from "@/lib/document-vault/cors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Document Vault — asset catalogue.
 *
 * Lists DocumentVaultAsset rows (a shared, non-owner-scoped catalogue of
 * approved assets). Optional `?project=` filter. The table may be empty →
 * returns `{ assets: [] }`.
 */
export function OPTIONS(req: Request) {
  return vaultCorsPreflight(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  try {
    await requireAuth();
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  const project = req.nextUrl.searchParams.get("project");

  try {
    const assets = await prisma.documentVaultAsset.findMany({
      where: project ? { project } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return withVaultCors(NextResponse.json({ assets }), req);
  } catch (err) {
    logger.error(
      "document-vault: list assets failed",
      { project: project ?? null },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to list assets" }, { status: 500 }),
      req,
    );
  }
}
