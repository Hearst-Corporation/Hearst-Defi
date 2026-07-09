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
 * Document Vault — collection route.
 *
 * GET  → lists the authenticated user's documents (ownerId-scoped), newest
 *        first, WITHOUT the heavy `deckJson` payload.
 * POST → creates a document owned by the caller and writes a "created" event.
 *
 * Every query is scoped by `ownerId: userId` — a user can never read or write
 * another user's documents.
 */

const CreateDocumentSchema = z.object({
  title: z.string().min(1).max(300),
  type: z.string().min(1).max(50),
  project: z.string().max(200).nullish(),
  source: z.string().max(50).optional(),
  status: z.string().max(50).optional(),
  // deckJson is an opaque SlideRenderer Deck — stored/returned verbatim.
  deckJson: z.unknown(),
  thumbnailUrl: z.string().max(2000).nullish(),
  slideCount: z.number().int().min(0).max(10_000).optional(),
});

export function OPTIONS(req: Request) {
  return vaultCorsPreflight(req);
}

export async function GET(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  try {
    const documents = await prisma.documentVaultDocument.findMany({
      where: { ownerId: userId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        type: true,
        project: true,
        source: true,
        status: true,
        slideCount: true,
        thumbnailUrl: true,
        updatedAt: true,
        createdAt: true,
      },
    });
    return withVaultCors(NextResponse.json({ documents }), req);
  } catch (err) {
    logger.error(
      "document-vault: list documents failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to list documents" }, { status: 500 }),
      req,
    );
  }
}

export async function POST(req: NextRequest): Promise<Response> {
  let userId: string;
  try {
    ({ userId } = await requireAuth());
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Authentication required" }, { status: 401 }),
      req,
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return withVaultCors(
      NextResponse.json({ error: "Invalid JSON body" }, { status: 400 }),
      req,
    );
  }

  const parsed = CreateDocumentSchema.safeParse(raw);
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

  try {
    const document = await prisma.documentVaultDocument.create({
      data: {
        ownerId: userId,
        title: body.title,
        type: body.type,
        ...(body.project != null ? { project: body.project } : {}),
        ...(body.source ? { source: body.source } : {}),
        ...(body.status ? { status: body.status } : {}),
        // Prisma Json column — round-trips the deck unchanged.
        deckJson: body.deckJson as never,
        ...(body.thumbnailUrl != null ? { thumbnailUrl: body.thumbnailUrl } : {}),
        ...(body.slideCount != null ? { slideCount: body.slideCount } : {}),
      },
    });

    await prisma.documentVaultEvent
      .create({
        data: {
          documentId: document.id,
          actorId: userId,
          eventType: "created",
        },
      })
      .catch((err: unknown) => {
        // The event log is best-effort — never fail the create over it.
        logger.warn(
          "document-vault: created event write failed",
          { userId, documentId: document.id },
          err instanceof Error ? err : undefined,
        );
      });

    return withVaultCors(NextResponse.json({ document }, { status: 201 }), req);
  } catch (err) {
    logger.error(
      "document-vault: create document failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to create document" }, { status: 500 }),
      req,
    );
  }
}
