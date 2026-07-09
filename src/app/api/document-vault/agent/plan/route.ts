import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/require-auth";
import { withVaultCors, vaultCorsPreflight } from "@/lib/document-vault/cors";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Document Vault — deterministic planner.
 *
 * There is NO document-agent lib in THIS repo (the docs-vault app carries its
 * own richer planner). This route implements a SMALL, deterministic keyword →
 * documentType mapping inline: no LLM call, no fetch, no I/O. It always reports
 * `planner: "deterministic"` — it never fakes an LLM planner.
 */

const PlanRequestSchema = z.object({
  request: z.string().min(1).max(4000),
  project: z.string().max(200).nullish(),
  documentType: z.string().max(50).nullish(),
  assets: z.array(z.unknown()).max(500).optional(),
  context: z.unknown().optional(),
});

type DocumentType = "pitch_deck" | "fact_sheet" | "product_sheet" | "one_pager";

/**
 * Keyword → document type. Ordered by specificity: the first family whose
 * keywords appear in the (lowercased) request wins. Defaults to pitch_deck.
 */
const TYPE_KEYWORDS: ReadonlyArray<readonly [DocumentType, readonly string[]]> = [
  ["fact_sheet", ["fact sheet", "factsheet", "fact-sheet", "fiche", "term sheet", "termsheet"]],
  ["product_sheet", ["product sheet", "product-sheet", "product page", "produit", "spec sheet"]],
  ["one_pager", ["one pager", "one-pager", "onepager", "1 pager", "1-pager", "summary", "brief"]],
  ["pitch_deck", ["pitch", "deck", "presentation", "slides", "slide deck", "investor deck"]],
];

function resolveDocumentType(request: string, hint?: string | null): DocumentType {
  const allowed: ReadonlySet<DocumentType> = new Set([
    "pitch_deck",
    "fact_sheet",
    "product_sheet",
    "one_pager",
  ]);
  if (hint && allowed.has(hint as DocumentType)) return hint as DocumentType;

  const haystack = request.toLowerCase();
  for (const [type, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((kw) => haystack.includes(kw))) return type;
  }
  return "pitch_deck";
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

  const parsed = PlanRequestSchema.safeParse(raw);
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
    const type = resolveDocumentType(body.request, body.documentType);
    return withVaultCors(
      NextResponse.json({
        plan: { request: body.request, type },
        warnings: [] as string[],
        selectedAssets: [] as unknown[],
        persistenceTarget: "database",
        planner: "deterministic",
      }),
      req,
    );
  } catch (err) {
    logger.error(
      "document-vault: plan failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return withVaultCors(
      NextResponse.json({ error: "Failed to build plan" }, { status: 500 }),
      req,
    );
  }
}
