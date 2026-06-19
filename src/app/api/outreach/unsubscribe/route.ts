import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { verifyUnsubscribeToken } from "@/lib/outreach/unsubscribe";

/**
 * One-click unsubscribe endpoint for outreach emails (compliance — every cold
 * email carries a link to here). No session: the recipient clicks from their
 * inbox. Authorisation is the signed token (HMAC over the email), so a third
 * party cannot opt out an arbitrary address.
 *
 * On a valid token:
 *   1. add the email to OutreachSuppression (reason "opt_out", permanent) so the
 *      sender skips it forever — upsert, idempotent on repeat clicks;
 *   2. flip any matching OutreachProspect to status "opted_out".
 * Always renders a friendly HTML confirmation (even on an already-opted-out
 * address) so the recipient gets closure. An invalid/forged token → 400 page.
 *
 * GET is intentional: email clients only follow links via GET. The action is
 * idempotent and safe to repeat, so GET-as-mutation is acceptable here (the
 * token is unguessable and scoped to a single address).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function page(title: string, message: string, status: number): NextResponse {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title></head>
<body style="font-family:sans-serif;background:#0a0a0a;color:#e5e7eb;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;">
<div style="max-width:420px;padding:32px 24px;text-align:center;">
<h1 style="color:#a7fb90;font-size:20px;margin:0 0 12px;">${title}</h1>
<p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0;">${message}</p>
</div></body></html>`;
  return new NextResponse(html, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const token = request.nextUrl.searchParams.get("token") ?? "";
  const email = verifyUnsubscribeToken(token);

  if (!email) {
    return page(
      "Invalid link",
      "This unsubscribe link is invalid or has expired. If you keep receiving emails, reply asking to be removed.",
      400,
    );
  }

  const normalized = email.toLowerCase();

  try {
    // 1. Suppress the address forever (idempotent on repeat clicks).
    await prisma.outreachSuppression.upsert({
      where: { email: normalized },
      update: { reason: "opt_out", until: null },
      create: { email: normalized, reason: "opt_out", until: null },
    });

    // 2. Flip any matching prospect to opted_out (best-effort; absence is fine —
    //    a direct-send recipient may have no prospect row).
    await prisma.outreachProspect.updateMany({
      where: { email: normalized },
      data: { status: "opted_out" },
    });
  } catch (err) {
    logger.error("[outreach/unsubscribe] failed to record opt-out", {
      error: err instanceof Error ? err.message : String(err),
    });
    // Still confirm to the user — we never want to look broken on an opt-out,
    // and the suppression upsert is safe to retry on a later click.
  }

  return page(
    "You're unsubscribed",
    "You will no longer receive outreach emails from Hearst Connect. It may take a moment to take effect across any in-flight sends.",
    200,
  );
}
