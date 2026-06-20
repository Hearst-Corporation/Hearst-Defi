import { serve } from "inngest/next";

import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { inngest } from "@/lib/inngest/client";
import { distributionExecuted } from "@/lib/inngest/functions/distribution-executed";
import { investorMemoMonthly } from "@/lib/inngest/functions/investor-memo-monthly";
import { marketDataHourly } from "@/lib/inngest/functions/market-data-hourly";
import { miningHealthDaily } from "@/lib/inngest/functions/mining-health-daily";
import { rebalancingSignal } from "@/lib/inngest/functions/rebalancing-signal";
import { riskDaily } from "@/lib/inngest/functions/risk-daily";
import { hubspotReverseSync } from "@/lib/inngest/functions/hubspot-reverse-sync";
import { outreachSend } from "@/lib/inngest/functions/outreach-send";
import { outreachAutoSend } from "@/lib/inngest/functions/outreach-auto-send";
import { outreachFollowups } from "@/lib/inngest/functions/outreach-followups";
import { custodySnapshotHourly } from "@/lib/inngest/functions/custody-snapshot-hourly";

/**
 * Inngest webhook endpoint.
 *
 * Inngest invokes this URL to discover registered functions and execute
 * individual steps. Cron triggers are scheduled by the Inngest platform
 * and dispatched here.
 *
 * Registered functions:
 *   - market-data-hourly     (every hour)
 *   - mining-health-daily    (08:00 UTC daily)
 *   - risk-daily             (09:30 UTC daily)
 *   - investor-memo-monthly  (1st of month 09:00 UTC)
 *   - rebalancing-signal     (event-driven: risk.daily.completed, rebalance.signal.requested)
 *   - distribution-executed  (event-driven: distribution.executed)
 *   - hubspot-reverse-sync   (every 15 min: HubSpot → QualificationProfile)
 *   - outreach-send               (event-driven: outreach.campaign.send)
 *   - custody-snapshot-hourly    (every hour at minute 5)
 *
 * Security — request signature verification (P0):
 *
 * Every GET/POST/PUT here is signature-verified by `serve()` BEFORE any
 * function or step runs. inngest@4's `InngestCommHandler` runs request
 * signature validation unconditionally: `skipSignatureValidation`
 * defaults to `false` (InngestCommHandler.js:193) and is never enabled
 * by this route, so it always rejects a missing/invalid
 * `X-Inngest-Signature` header — and throws if no signing key is
 * available — before dispatching anything.
 *
 * The signing key is sourced by the `Inngest` client (see
 * `@/lib/inngest/client`) from the `INNGEST_SIGNING_KEY` env var. In
 * inngest@4 `signingKey` is a `ClientOptions` field (constructor-level),
 * NOT a `serve()` option, so it is intentionally not duplicated here.
 *
 * Defense in depth: `src/lib/env.ts` validates `INNGEST_SIGNING_KEY`
 * with Zod and HARD-FAILS at server boot in production if it is absent
 * (see the `IS_RUNTIME_PRODUCTION` guard). The reference below makes
 * that contract explicit and load-bearing for this endpoint: this route
 * can never run unauthenticated in production.
 */
// Reading the validated env enforces the boot-time guard that
// `INNGEST_SIGNING_KEY` is present in production (see src/lib/env.ts).
const SIGNATURE_VERIFICATION_KEY = env.INNGEST_SIGNING_KEY;
if (
  process.env.NODE_ENV === "production" &&
  process.env.NEXT_PHASE !== "phase-production-build" &&
  !SIGNATURE_VERIFICATION_KEY
) {
  throw new Error(
    "INNGEST_SIGNING_KEY missing — /api/inngest would accept unsigned requests.",
  );
}

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    marketDataHourly,
    miningHealthDaily,
    riskDaily,
    investorMemoMonthly,
    rebalancingSignal,
    distributionExecuted,
    hubspotReverseSync,
    outreachSend,
    outreachAutoSend,
    outreachFollowups,
    custodySnapshotHourly,
  ],
  // Pass the validated signing key explicitly to `serve()`. inngest@4 would
  // otherwise fall back to reading INNGEST_SIGNING_KEY itself, but wiring it
  // here makes signature verification load-bearing and explicit for this
  // route (the client at @/lib/inngest/client does NOT set it).
  ...(SIGNATURE_VERIFICATION_KEY
    ? { signingKey: SIGNATURE_VERIFICATION_KEY }
    : {}),
});
