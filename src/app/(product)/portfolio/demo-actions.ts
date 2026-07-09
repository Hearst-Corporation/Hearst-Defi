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
import { seedZandFixturePosition, ZAND_FIXTURE_EMAIL } from "@/lib/demo/zand-fixture";
import { subscribe } from "@/app/actions/subscribe";

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

/** $250k Class A — the standard demo opening ticket (matches simulateDeposit's default). */
const DEMO_SEED_AMOUNT_USDC = 250_000;
const DEMO_SEED_VAULT_ID = "hearst-yield-vault";

/**
 * Client-safe error copy for the failure modes `advanceInvestorTimeline` /
 * `resetInvestorTimeline` / `subscribe` can throw. Never surfaces a raw
 * `error.message` to the browser (that leaked DB/jargon phrasing like
 * "Refusing: position principal $X exceeds..." in front of a client — see
 * fix #3). Anything unrecognized falls back to a single generic line; the
 * real detail is only ever logged server-side via console.error below.
 */
function toClientMessage(stage: DemoTimelineStage | "seed", error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (raw.includes("No active/matured position found")) {
    return "Subscribe first — there's no position yet to advance.";
  }
  if (raw.includes("exceeds the safety cap")) {
    return "Could not advance the demo timeline — the position amount is out of range for this demo.";
  }

  const verb = stage === "seed" ? "seed the demo position" : "advance the demo timeline";
  return `Could not ${verb}. Please try again.`;
}

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
        message = `Advanced to +12 months. ${result.positionIds.length} position(s) ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
      case "24m": {
        const result = await advanceInvestorTimeline(prisma, investorId, 24, { matured: false });
        message = `Advanced to +24 months. ${result.positionIds.length} position(s) ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
      case "expiry": {
        const result = await advanceInvestorTimeline(prisma, investorId, 24, { matured: true });
        message = `Advanced to expiry. ${result.positionIds.length} position(s) ${result.status}, distributed $${result.distributedUsdc.toLocaleString()}.`;
        break;
      }
    }

    revalidatePath("/portfolio");
    return { ok: true, message };
  } catch (error) {
    // Detail stays server-side; the client only ever gets clean, mapped copy.
    console.error(`[demoAdvanceTimeline] stage=${stage} investorId=${investorId} failed:`, error);
    return { ok: false, error: toClientMessage(stage, error) };
  }
}

// =============================================================================
// demoSeedPosition — subscribes the demo investor to a fresh $250k position.
// =============================================================================
//
// Closes the Reset → Advance gap: after `demoAdvanceTimeline("reset")` wipes
// every position, +12m/+24m/Expiry have nothing to age and throw. This gives
// the in-app control a way to re-seed a clean opening position without a
// terminal, completing the full Reset (0) → Subscribe $250k → +12m/+24m/Expiry
// loop from the browser. Reuses the same audited `subscribe()` server action
// `simulateDeposit` already uses (src/lib/demo/actions.ts) — off-chain,
// KYC/accreditation/capacity/min-ticket all still enforced by subscribe()
// itself, nothing bypassed except the on-chain settlement requirement.
export async function demoSeedPosition(): Promise<DemoTimelineResult> {
  const session = await requireInvestor("/portfolio");

  if (!isDemoAccount(session.email)) {
    // A real investor must never reach the write path below.
    return { ok: false, error: "This action is only available on demo accounts." };
  }

  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }

  try {
    const result = await subscribe(
      DEMO_SEED_VAULT_ID,
      DEMO_SEED_AMOUNT_USDC,
      "A",
      undefined,
      { allowOffChain: true },
    );
    if (!result.ok) {
      console.error(`[demoSeedPosition] investorId=${investor.id} failed:`, result.error);
      return { ok: false, error: toClientMessage("seed", new Error(result.error)) };
    }

    revalidatePath("/portfolio");
    return {
      ok: true,
      message: `Subscribed $${DEMO_SEED_AMOUNT_USDC.toLocaleString()} — position ${result.positionId} created.`,
    };
  } catch (error) {
    console.error(`[demoSeedPosition] investorId=${investor.id} failed:`, error);
    return { ok: false, error: toClientMessage("seed", error) };
  }
}

// =============================================================================
// demoSeedZandFixture — re-creates the Zand $2M institutional fixture in-app.
// =============================================================================
//
// "Reset (0)" wipes to a genuinely empty portfolio (no automatic re-seed), so
// the $2M + 12-distribution story a partner demo runs on would otherwise only
// be recoverable via the CLI seeder (prisma/seed-zand-demo.ts). This lever
// closes that gap from the browser. Gates:
//   1. requireInvestor() — authenticated session.
//   2. isDemoAccount(session.email) — demo accounts only (defence in depth).
//   3. session email must be the Zand fixture account itself — the $2M
//      institutional fixture belongs to that one account's story; other demo
//      accounts keep their own $250k seed lever.
// Idempotent: seedZandFixturePosition no-ops (created:false) when the fixture
// deposit marker already exists. Not a financial/custodial action.
export async function demoSeedZandFixture(): Promise<DemoTimelineResult> {
  const session = await requireInvestor("/portfolio");

  if (!isDemoAccount(session.email)) {
    return { ok: false, error: "This action is only available on demo accounts." };
  }
  if (session.email.trim().toLowerCase() !== ZAND_FIXTURE_EMAIL) {
    return { ok: false, error: "This fixture belongs to the Zand demo account." };
  }

  const investor = await getInvestor();
  if (!investor) {
    return { ok: false, error: "Authentication required." };
  }

  try {
    const result = await seedZandFixturePosition(prisma, investor.id);

    revalidatePath("/portfolio");
    revalidatePath("/profile");
    return {
      ok: true,
      message: result.created
        ? `Seeded the $2,000,000 fixture — position ${result.positionId}, $${result.distributedUsdc.toLocaleString()} distributed.`
        : "The $2M fixture already exists — nothing re-created.",
    };
  } catch (error) {
    console.error(`[demoSeedZandFixture] investorId=${investor.id} failed:`, error);
    return { ok: false, error: toClientMessage("seed", error) };
  }
}
