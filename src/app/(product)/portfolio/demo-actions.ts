"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/db";
import { requireInvestor } from "@/lib/auth/require-investor";
import { getInvestor } from "@/lib/auth/session";
import { isDemoAccount } from "@/lib/demo/allowlist";
import {
  resetInvestorTimeline,
  advanceInvestorTimeline,
} from "@/lib/demo/timeline-core";

// =============================================================================
// demoAdvanceTimeline — in-app "time machine" for the current demo investor.
// =============================================================================
//
// Lets a demo account walk its OWN position through the lifecycle stages the
// terminal script `scripts/demo/timeline.ts` already knows how to produce
// (reset / 12 months in / 24 months in / expiry-matured), without leaving the
// browser. Every guard mirrors src/lib/demo/actions.ts:
//   1. requireInvestor() proves an authenticated session.
//   2. isDemoAccount(session.email) — checked BEFORE any read/write; a real
//      investor is refused (the panel is also never rendered for them — see
//      demo-timeline-control.tsx + portfolio/page.tsx — this is defence in
//      depth, not the only gate).
//   3. All writes are scoped to THIS investor's own id (timeline-core.ts never
//      takes an investorId parameter that isn't this one) — never a global
//      wipe, never another investor's position.
//
// No ALLOW_PROD_WRITES guard here on purpose: that flag exists for the CLI
// script's own footgun protection when a developer points it at prod by
// mistake. This action only ever runs as part of the deployed app (dev or
// prod), gated purely by isDemoAccount — the same posture as resetDemoAccount
// and simulateDeposit above. Not a financial/custodial action: it only
// rewrites the demo account's own bookkeeping rows (distributions, NAV
// snapshots, position status) to simulate elapsed time.

export type DemoTimelineStage = "reset" | "12m" | "24m" | "expiry";

export type DemoTimelineResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

export async function demoAdvanceTimeline(
  stage: DemoTimelineStage,
): Promise<DemoTimelineResult> {
  const session = await requireInvestor("/portfolio");

  if (!isDemoAccount(session.email)) {
    // A real investor must never reach the write path below.
    return { ok: false, error: "This action is only available on demo accounts." };
  }

  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }
  const investorId = investor.id;

  try {
    let message: string;

    switch (stage) {
      case "reset": {
        const result = await resetInvestorTimeline(prisma, investorId);
        message = `Reset. Deleted ${result.positionsDeleted} position(s), ${result.transactionsDeleted} transaction(s), ${result.navSnapshotsDeleted} NAV snapshot(s).`;
        break;
      }
      case "12m": {
        const result = await advanceInvestorTimeline(prisma, investorId, 12, { matured: false });
        message = `Advanced to +12 months. Position ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
      case "24m": {
        const result = await advanceInvestorTimeline(prisma, investorId, 24, { matured: false });
        message = `Advanced to +24 months. Position ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
      case "expiry": {
        const result = await advanceInvestorTimeline(prisma, investorId, 24, { matured: true });
        message = `Advanced to expiry. Position ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
    }

    revalidatePath("/portfolio");
    return { ok: true, message };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Failed to advance the demo timeline.",
    };
  }
}
