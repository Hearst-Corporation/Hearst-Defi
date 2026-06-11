import { createReviewDocumentRoute } from "@hearst/review-mode";
import { prisma } from "@/lib/db";
import { kimi, LLM_MODEL } from "@/lib/llm/kimi";
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
  kimi,
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
