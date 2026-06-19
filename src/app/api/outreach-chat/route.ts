import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/lib/auth/require-admin";
import { assertRateLimit, assertBodySize } from "@/lib/rate-limit";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { runSourcing } from "@/app/admin/outreach/actions";
import { classifyOutreachIntent } from "@/lib/outreach/copilot-intent";
import { TIER_LABEL, TIER_AUTONOMY, type Tier } from "@/lib/outreach/tier";

/**
 * Outreach copilot endpoint — the brain behind the in-page chat on
 * /admin/outreach. Admin-only. Takes one operator message, classifies the
 * intent (Palier 0: deterministic; Palier 1: GPT-4.1), and either ACTS through
 * the same admin Server Actions the buttons use, or answers from the DB.
 *
 * Human-in-the-loop is preserved: the only mutating action exposed here is
 * sourcing, which merely creates `new` prospects for review. NO email is ever
 * sent from this route (that stays gated behind the tiered send policy + the
 * explicit Release flow). Reads (stats / tier lists) are obviously safe.
 *
 * Response shape: { reply: string, refresh?: boolean } — `refresh` tells the
 * client to re-pull the page (revalidatePath already ran server-side; the flag
 * lets the panel trigger a router.refresh()).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  message: z.string().trim().min(1).max(2000),
});

interface CopilotResponse {
  reply: string;
  refresh?: boolean;
}

const HELP_TEXT = [
  "I'm your outreach copilot. I can:",
  "• **Source leads** — “find 20 distributor leads” (runs the sourcer on your active ICP).",
  "• **Show a tier** — “show the prime leads” / “tier B”.",
  "• **Status** — “how many prospects?”, “pipeline overview”.",
  "",
  "I never send emails — I find, score, and tier leads for your review.",
].join("\n");

/** Picks the ICP to source against: the most recently active one. */
async function pickActiveIcpId(): Promise<string | null> {
  const icp = await prisma.outreachICP.findFirst({
    where: { active: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true },
  });
  return icp?.id ?? null;
}

async function handleSource(count: number): Promise<CopilotResponse> {
  const icpId = await pickActiveIcpId();
  if (!icpId) {
    return {
      reply:
        "No active ICP yet. Define a distributor ICP first (the “Define a distributor ICP” button), then I can source against it.",
    };
  }
  const result = await runSourcing(icpId, count);
  const demo = result.isMock ? " _(demo leads — Apollo not wired yet)_" : "";
  return {
    reply:
      `Sourced **${result.sourced}** lead${result.sourced === 1 ? "" : "s"}${demo} — ` +
      `Prime ${result.byTier.A} · Warm ${result.byTier.B} · Cold ${result.byTier.C}.` +
      (result.skipped > 0 ? ` ${result.skipped} duplicate(s) skipped.` : "") +
      ` They're in the directory as **new**, awaiting drafting. Nothing was sent.`,
    refresh: true,
  };
}

async function handleShowTier(tier: Tier): Promise<CopilotResponse> {
  const rows = await prisma.outreachProspect.findMany({
    where: { tier },
    orderBy: { qualScore: "desc" },
    take: 10,
    select: { email: true, company: true, qualScore: true },
  });
  if (rows.length === 0) {
    return {
      reply: `No Tier ${tier} (${TIER_LABEL[tier]}) leads yet. Source some first.`,
    };
  }
  const lines = rows
    .map(
      (r) =>
        `• ${r.company ?? r.email} — score ${r.qualScore ?? "?"} (${r.email})`,
    )
    .join("\n");
  return {
    reply:
      `**Tier ${tier} — ${TIER_LABEL[tier]}** (${TIER_AUTONOMY[tier]})\n${lines}` +
      (rows.length === 10 ? "\n…showing top 10 by score." : ""),
  };
}

async function handleStats(): Promise<CopilotResponse> {
  const [byTier, byStatus, total] = await Promise.all([
    prisma.outreachProspect.groupBy({ by: ["tier"], _count: { _all: true } }),
    prisma.outreachProspect.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.outreachProspect.count(),
  ]);
  const tierLine = (["A", "B", "C"] as const)
    .map((t) => {
      const n = byTier.find((g) => g.tier === t)?._count._all ?? 0;
      return `${t}:${n}`;
    })
    .join(" · ");
  const statusLine = byStatus
    .map((g) => `${g.status}:${g._count._all}`)
    .join(" · ");
  return {
    reply:
      `**${total}** prospect${total === 1 ? "" : "s"} in the directory.\n` +
      `Tiers — ${tierLine}\nStatus — ${statusLine || "none"}`,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await assertBodySize(request);
    const admin = await requireAdmin();
    await assertRateLimit(`outreach-chat:${admin.userId}`, 30, 60_000);

    const json: unknown = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    const intent = classifyOutreachIntent(parsed.data.message);

    let response: CopilotResponse;
    switch (intent.kind) {
      case "source":
        response = await handleSource(intent.count);
        break;
      case "show_tier":
        response = await handleShowTier(intent.tier);
        break;
      case "stats":
        response = await handleStats();
        break;
      case "help":
        response = { reply: HELP_TEXT };
        break;
      case "unknown":
        response = {
          reply:
            "I didn't catch an action there. Try “source 20 leads”, “show prime leads”, or “status”. Type “help” for the full list.",
        };
        break;
    }

    return NextResponse.json(response);
  } catch (err) {
    // requireAdmin throws on auth failure — surface as 403, everything else 500.
    const message = err instanceof Error ? err.message : String(err);
    if (/admin|auth/i.test(message)) {
      return NextResponse.json({ error: "Admin access required" }, { status: 403 });
    }
    logger.error("[outreach-chat] failed", { error: message });
    return NextResponse.json({ error: "Copilot error" }, { status: 500 });
  }
}
