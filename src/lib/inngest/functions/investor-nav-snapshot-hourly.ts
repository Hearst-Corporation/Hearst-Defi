import "server-only";

import { inngest } from "@/lib/inngest/client";
import { captureAllInvestorNavSnapshots } from "@/lib/portfolio/investor-nav-snapshot";
import { isDuplicate, markComplete } from "@/lib/idempotency";

/**
 * Investor NAV Snapshot — hourly cron (minute 10, offset from custody at :05).
 *
 * Reads each investor's live position NAV (principal + accrued) and persists
 * one print per UTC hour. No interpolation — the chart only shows stored prints.
 *
 * VaultSnapshot is vault-level AUM and cannot be mapped per-investor without
 * inventing allocation. Position.accruedYieldUsdc has no time-series history.
 */
export const INVESTOR_NAV_SNAPSHOT_HOURLY_ID = "investor-nav-snapshot-hourly" as const;
export const INVESTOR_NAV_SNAPSHOT_HOURLY_CRON = "10 * * * *" as const;

export interface InvestorNavSnapshotHourlyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export async function investorNavSnapshotHourlyHandler({
  step,
}: {
  step: InvestorNavSnapshotHourlyStep;
}): Promise<
  | { captured: number; skipped: number }
  | { skipped: true; reason: string }
> {
  const now = new Date();

  if (await isDuplicate(INVESTOR_NAV_SNAPSHOT_HOURLY_ID, now)) {
    return { skipped: true, reason: "already_run_this_hour" };
  }

  const result = await step.run("capture-all-investor-nav", () =>
    captureAllInvestorNavSnapshots(now),
  );

  await markComplete(INVESTOR_NAV_SNAPSHOT_HOURLY_ID, now);

  return result;
}

export const investorNavSnapshotHourly = inngest.createFunction(
  {
    id: INVESTOR_NAV_SNAPSHOT_HOURLY_ID,
    concurrency: { limit: 1 },
    triggers: [{ cron: INVESTOR_NAV_SNAPSHOT_HOURLY_CRON }],
  },
  investorNavSnapshotHourlyHandler,
);
