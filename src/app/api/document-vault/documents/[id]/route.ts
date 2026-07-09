import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/db";
import { withVaultCors, vaultCorsPreflight } from "@/lib/document-vault/cors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Document Vault — single-document route (owner-scoped).
 *
 * GET    → returns the document only if it belongs to the caller, else 404
 *          (a 404 — never a 403 — so existence is never revealed cross-user).
 * PATCH  → partial update (title / deckJson / status / thumbnailUrl /
 *          slideCount) scoped to ownerId; writes an "updated" event.
 * DELETE → deleteMany scoped to { id, ownerId }; returns { ok: true }.
 */

const PatchDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  // deckJson is an opaque SlideRenderer Deck — stored/returned verbatim.
  deckJson: z.unknown().optional(),
  status: z.string().max(50).optional(),
  thumbnailUrl: z.string().max(2000).nullish(),
  slideCount: z.number().int().min(0).max(10_000).optional(),
});

export function OPTIONS(req: Request) {
  return vaultCorsPreflight(req);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  const { id } = await params;

  try {
    const document = await prisma.documentVaultDocument.findFirst({
      where: { id, ownerId: userId },
    });
    if (!document) {
      // Do not distinguish "not found" from "owned by someone else".
      return withVaultCors(NextResponse.json({ error: "Not found" }, { status: 404 }), req);
    }
    return withVaultCors(NextResponse.json({ document }), req);
  } catch (err) {
    logger.error(
      "document-vault: get document failed",
      { userId, documentId: id },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to load document" }, { status: 500 }),
      req,
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  const { id } = await params;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      req,
    );
  }

  const parsed = PatchDocumentSchema.safeParse(raw);
  if (!parsed.success) {
    return withVaultCors(
      NextResponse.json(
        { error: "Invalid request body", issues: parsed.error.issues },
        { status: 400 },
      ),
      req,
    );
  }
  const body = parsed.data;

  const data: Record<string, unknown> = {};
  if (body.title !== undefined) data.title = body.title;
  if (body.deckJson !== undefined) data.deckJson = body.deckJson;
  if (body.status !== undefined) data.status = body.status;
  if (body.thumbnailUrl !== undefined) data.thumbnailUrl = body.thumbnailUrl;
  if (body.slideCount !== undefined) data.slideCount = body.slideCount;

  try {
    // updateMany with the ownerId predicate guarantees we only touch the
    // caller's own row (a foreign id updates 0 rows → 404).
    const result = await prisma.documentVaultDocument.updateMany({
      where: { id, ownerId: userId },
      data: data as never,
    });
    if (result.count === 0) {
      return withVaultCors(NextResponse.json({ error: "Not found" }, { status: 404 }), req);
    }

    const document = await prisma.documentVaultDocument.findFirst({
      where: { id, ownerId: userId },
    });

    await prisma.documentVaultEvent
      .create({
        data: {
          documentId: id,
          actorId: userId,
          eventType: "updated",
        },
      })
      .catch((err: unknown) => {
        logger.warn(
          "document-vault: updated event write failed",
          { userId, documentId: id },
          err instanceof Error ? err : undefined,
        );
      });

    return withVaultCors(NextResponse.json({ document }), req);
  } catch (err) {
    logger.error(
      "document-vault: patch document failed",
      { userId, documentId: id },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to update document" }, { status: 500 }),
      req,
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  const { id } = await params;

  try {
    // deleteMany scoped to the owner — a foreign id deletes nothing. Related
    // events cascade (onDelete: Cascade in the schema).
    await prisma.documentVaultDocument.deleteMany({
      where: { id, ownerId: userId },
    });
    return withVaultCors(NextResponse.json({ ok: true }), req);
  } catch (err) {
    logger.error(
      "document-vault: delete document failed",
      { userId, documentId: id },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to delete document" }, { status: 500 }),
      req,
    );
  }
}
