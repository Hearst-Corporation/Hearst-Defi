import { createReviewDocumentRoute } from "@hearst/review-mode";
import { prisma } from "@/lib/db";
import { openai, LLM_MODEL } from "@/lib/llm/openai";
import { requireAdmin } from "@/lib/auth/require-admin";
import { logger } from "@/lib/logger";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import { getProductRoutes } from "@/lib/product-routes";
import { getSpecIndex } from "@/lib/spec";
import { PRODUCT_CONTEXT } from "@/lib/product-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createReviewDocumentRoute({
  prisma,
  // `kimi` is the dep key name fixed by @hearst/review-mode's API; the value is
  // the OpenAI GPT-4.1 client (ADR-011). Renaming the key would break the typed
  // contract of the shared package.
  kimi: openai,
  model: LLM_MODEL,
  requireAdmin,
  logger,
  productContext: PRODUCT_CONTEXT,
  assertRateLimit,
  assertBodySize,
  getProductRoutes,
  getSpecIndex,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
