import "server-only";

import { revalidateTag } from "next/cache";

import { inngest } from "@/lib/inngest/client";
import { authoritativeVaultSnapshotWhere } from "@/lib/data/snapshot-sources";
import { loadCustody } from "@/lib/data/custody";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isDuplicate, markComplete } from "@/lib/idempotency";

/**
 * Custody Snapshot — hourly cron (minute 5, offset from market-data-hourly at :00).
 *
 * Reads the real Fireblocks vault balance via loadCustody(). If and only if the
 * vault contains real funds (provenance "live", configured, reserves > 0), writes
 * a new VaultSnapshot with source="live", upgrading the dashboard from "seeded" to
 * "live" state.
 *
 * HARD GUARD: if the vault is empty or unconfigured the job writes NOTHING —
 * no VaultSnapshot row, no fake AUM. This is the honesty contract: an empty
 * vault must never produce a "live" snapshot.
 *
 * Inherited fields (APY range, risk scores, mode, allocations) come from the
 * most recent AUTHORITATIVE VaultSnapshot (seed/demo sources excluded) so we
 * never invent financial parameters that belong to the engine/agent layer.
 * When no authoritative prior snapshot exists, the job skips the write rather
 * than fabricating zero scores.
 */
export const CUSTODY_SNAPSHOT_HOURLY_ID = "custody-snapshot-hourly" as const;
export const CUSTODY_SNAPSHOT_HOURLY_CRON = "5 * * * *" as const;

export interface CustodySnapshotHourlyStep {
  run<T>(name: string, fn: () => T | Promise<T>): Promise<T>;
}

export async function custodySnapshotHourlyHandler({
  step,
}: {
  step: CustodySnapshotHourlyStep;
}): Promise<
  | { aumUsdc: number; source: "live"; snapshotId: string }
  | { skipped: true; reason: string }
> {
  const now = new Date();

  if (await isDuplicate(CUSTODY_SNAPSHOT_HOURLY_ID, now)) {
    return { skipped: true, reason: "already_run_this_hour" };
  }

  // ─── Step 1: load real Fireblocks custody balance ─────────────────────────
  const custody = await step.run("load-custody", () => loadCustody());

  // ─── HARD GUARD ───────────────────────────────────────────────────────────
  // An empty vault, unconfigured scope, or non-live provenance must NEVER
  // produce a snapshot row. This is the single point that enforces honesty.
  // The vault is currently empty (0 USDC) so this branch will be taken on
  // every run until Fireblocks account 86 holds real funds.
  // `totalUsdcReserves === null` means nothing was read (provider unreachable,
  // or not configured). It is checked FIRST and explicitly: a null must never
  // reach `aumUsdc` below, and `null <= 0` would not have caught it. A real 0
  // is a measured empty vault and still skips, for a different reason.
  if (
    !custody.configured ||
    custody.provenance !== "live" ||
    custody.totalUsdcReserves === null ||
    custody.totalUsdcReserves <= 0
  ) {
    logger.info("[custody-snapshot-hourly] vault empty or unconfigured — skipping write", {
      provenance: custody.provenance,
      configured: custody.configured,
      totalUsdcReserves: custody.totalUsdcReserves,
    });
    await markComplete(CUSTODY_SNAPSHOT_HOURLY_ID, now);
    return { skipped: true, reason: "vault_empty_or_unconfigured" };
  }

  // ─── Step 2: load latest snapshot to inherit engine-derived fields ─────────
  // APY range, risk scores, mode, and allocations come from the previous
  // VaultSnapshot — they are owned by the engine/agent layer and must not be
  // invented here. Seed guard: only authoritative sources are inherited, so a
  // reappeared demo_seed row can never be laundered into a "live" snapshot.
  const previous = await step.run("load-latest-snapshot", () =>
    prisma.vaultSnapshot.findFirst({
      where: authoritativeVaultSnapshotWhere(),
      orderBy: { takenAt: "desc" },
      include: { allocations: true },
    }),
  );

  // The engine-owned columns are non-nullable in the schema, so with no
  // authoritative prior snapshot we cannot inherit — and inventing zero
  // APY/risk scores would fabricate financial parameters. Skip the write.
  if (previous === null) {
    logger.info(
      "[custody-snapshot-hourly] no authoritative prior snapshot — skipping write (refusing to invent engine fields)",
    );
    await markComplete(CUSTODY_SNAPSHOT_HOURLY_ID, now);
    return { skipped: true, reason: "no_authoritative_prior_snapshot" };
  }

  const inheritedApyLow    = previous.currentApyLow;
  const inheritedApyHigh   = previous.currentApyHigh;
  const inheritedStressed  = previous.stressedApy;
  const inheritedRisk      = previous.riskScore;
  const inheritedMining    = previous.miningMarginScore;
  const inheritedMode      = previous.mode;

  // ─── Step 3: persist live snapshot ────────────────────────────────────────
  const snapshotId = await step.run("persist-snapshot", async () => {
    // The guard above already rejected null, but this runs in a new closure so
    // the narrowing is gone. Re-assert rather than cast: if the guard is ever
    // loosened, this throws instead of writing a null AUM into the snapshot.
    const liveAum = custody.totalUsdcReserves;
    if (liveAum === null) {
      throw new Error("custody-snapshot-hourly: totalUsdcReserves is null after the guard — refusing to persist");
    }

    const snapshot = await prisma.vaultSnapshot.create({
      data: {
        takenAt:           now,
        aumUsdc:           liveAum,        // <── real Fireblocks balance, NOT a hardcode
        currentApyLow:     inheritedApyLow,
        currentApyHigh:    inheritedApyHigh,
        stressedApy:       inheritedStressed,
        riskScore:         inheritedRisk,
        miningMarginScore: inheritedMining,
        mode:              inheritedMode,
        source:            "live",
      },
    });

    // Inherit allocations from the previous snapshot if any exist.
    // valueUsdc is recalculated at the new AUM:
    //   valueUsdc = liveAum × (pct / 100)
    // This keeps allocation percentages stable while reflecting the real balance.
    // yieldContributionBps is copied verbatim — it is an engine output, not
    // something we can recompute here without running the full engine.
    if (previous?.allocations && previous.allocations.length > 0) {
      await prisma.allocation.createMany({
        data: previous.allocations.map((a) => ({
          snapshotId:           snapshot.id,
          bucket:               a.bucket,
          pct:                  a.pct,
          valueUsdc:            Number(a.pct) / 100 * liveAum,
          yieldContributionBps: a.yieldContributionBps,
        })),
      });
    }

    logger.info("[custody-snapshot-hourly] persisted live snapshot", {
      snapshotId: snapshot.id,
      aumUsdc:    liveAum,
      mode:       inheritedMode,
      allocationsCount: previous?.allocations?.length ?? 0,
    });

    return snapshot.id;
  });

  await markComplete(CUSTODY_SNAPSHOT_HOURLY_ID, now);

  // Bust the `unstable_cache(tags:["yield"])` entry backing loadAllocationDonut /
  // yield-stack reads: a fresh VaultSnapshot+Allocation just landed, so the
  // cached (and now stale) snapshot must be evicted or the donut/Capital & Yield
  // panel would show the previous hour's mix up to the 1h TTL.
  revalidateTag("yield", "max");

  return {
    aumUsdc:    custody.totalUsdcReserves,
    source:     "live",
    snapshotId,
  };
}

export const custodySnapshotHourly = inngest.createFunction(
  {
    id:          CUSTODY_SNAPSHOT_HOURLY_ID,
    concurrency: { limit: 1 },
    triggers:    [{ cron: CUSTODY_SNAPSHOT_HOURLY_CRON }],
  },
  custodySnapshotHourlyHandler,
);
