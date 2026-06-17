import "server-only";

import { inngest } from "@/lib/inngest/client";
import { reverseSyncFromHubSpot } from "@/lib/hubspot/sync-reverse";
import { logger } from "@/lib/logger";

/**
 * HubSpot reverse-sync — every 15 minutes.
 *
 * Pulls contacts modified in HubSpot and writes their `hearst_*` properties
 * back onto the matching QualificationProfile. This replaces an inbound
 * webhook (which HubSpot only supports via a Public App / Operations Hub) with
 * a poll that works with the Private App PAT alone.
 *
 * Window: looks back 20 minutes each run (15-min cron + 5-min overlap) so a
 * change is never missed between two runs. Idempotent — re-writing the same
 * values is a no-op.
 *
 * No-ops silently when HUBSPOT_API_KEY is unset (feature simply off).
 */
const ID = "hubspot-reverse-sync" as const;
const CRON = "*/15 * * * *" as const;
const LOOKBACK_MS = 20 * 60 * 1000; // 20 minutes (cron interval + overlap)

interface CronStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

async function handler({
  step,
}: {
  step: CronStep;
}): Promise<
  | { skipped: true; reason: string }
  | { scanned: number; updated: number; unmatched: number }
> {
  if (!process.env.HUBSPOT_API_KEY) {
    return { skipped: true, reason: "hubspot_not_configured" };
  }

  const sinceMs = Date.now() - LOOKBACK_MS;

  const result = await step.run("reverse-sync", async () => {
    try {
      return await reverseSyncFromHubSpot(sinceMs);
    } catch (err) {
      logger.error(
        "[hubspot-reverse-sync] failed",
        {},
        err instanceof Error ? err : new Error(String(err)),
      );
      throw err; // let Inngest retry
    }
  });

  logger.info("[hubspot-reverse-sync] done", {
    scanned: result.scanned,
    updated: result.updated,
    unmatched: result.unmatched,
  });
  return result;
}

export const hubspotReverseSync = inngest.createFunction(
  {
    id: ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: CRON }],
  },
  handler,
);
