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
 * Document Vault — create a document from a plan.
 *
 * Persists a new owner-scoped document built from a plan (see /agent/plan) plus
 * a caller-provided `deckJson`. The document is stamped `source: "agent"` and a
 * "created" event is written. `deckJson` round-trips unchanged.
 */

const PlanSchema = z.object({
  request: z.string().max(4000).optional(),
  type: z.string().min(1).max(50),
  project: z.string().max(200).nullish(),
});

const AgentCreateSchema = z.object({
  plan: PlanSchema,
  // deckJson is an opaque SlideRenderer Deck — stored/returned verbatim.
  deckJson: z.unknown(),
  title: z.string().min(1).max(300).optional(),
  thumbnailUrl: z.string().max(2000).nullish(),
  slideCount: z.number().int().min(0).max(10_000).optional(),
});

/** Fallback title derived from the plan when the caller supplies none. */
function deriveTitle(plan: z.infer<typeof PlanSchema>): string {
  const fromRequest = plan.request?.replace(/\s+/g, " ").trim();
  if (fromRequest) return fromRequest.slice(0, 120);
  return "Untitled document";
}

export function OPTIONS(req: Request) {
  return vaultCorsPreflight(req);
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

  const parsed = AgentCreateSchema.safeParse(raw);
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
  const { plan } = body;

  try {
    const document = await prisma.documentVaultDocument.create({
      data: {
        ownerId: userId,
        title: body.title?.trim() || deriveTitle(plan),
        type: plan.type,
        ...(plan.project != null ? { project: plan.project } : {}),
        source: "agent",
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
          payloadJson: { via: "agent", planType: plan.type } as never,
        },
      })
      .catch((err: unknown) => {
        logger.warn(
          "document-vault: agent-create event write failed",
          { userId, documentId: document.id },
          err instanceof Error ? err : undefined,
        );
      });

    return withVaultCors(NextResponse.json({ document }, { status: 201 }), req);
  } catch (err) {
    logger.error(
      "document-vault: agent create failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to create document" }, { status: 500 }),
      req,
    );
  }
}
