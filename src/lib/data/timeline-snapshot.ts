import "server-only";

import type { Prisma } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { ADMIN_DASHBOARD_REVALIDATE_SEC } from "@/lib/data/admin-dashboard-cache";
import { prisma } from "@/lib/db";

/**
 * Vault snapshot `source` values that represent the real vault timeline.
 * Excludes `computed` preset/scenario rows used by memo/scenario loaders.
 */
export const TIMELINE_SNAPSHOT_SOURCES = [
  "daily-seed",
  "live",
  "oracle",
  "attested",
] as const;

export type TimelineSnapshotSource = (typeof TIMELINE_SNAPSHOT_SOURCES)[number];

/**
 * Sources that indicate genuine production data — as opposed to seed/staging
 * data that happens to share the same table. Used to gate "Live" KPI signals.
 *
 * `daily-seed` is valid timeline data for charts/history but MUST NOT trigger
 * Live/Attested provenance badges on the admin dashboard.
 */
const LIVE_TIMELINE_SOURCES: ReadonlySet<TimelineSnapshotSource> = new Set([
  "live",
  "oracle",
  "attested",
]);

/**
 * Returns true when `source` represents real production data (not seed /
 * staging). Unknown or nullish sources are conservative (false).
 */
export function isLiveTimelineSource(
  source: TimelineSnapshotSource | string | null | undefined,
): boolean {
  if (source == null) return false;
  return LIVE_TIMELINE_SOURCES.has(source as TimelineSnapshotSource);
}

export function timelineSnapshotWhere(): { source: { in: TimelineSnapshotSource[] } } {
  return { source: { in: [...TIMELINE_SNAPSHOT_SOURCES] } };
}

type TimelineSnapshotFindArgs = {
  includeAllocations?: boolean;
  orderBy?: Prisma.VaultSnapshotOrderByWithRelationInput;
  where?: Prisma.VaultSnapshotWhereInput;
  select?: Prisma.VaultSnapshotSelect;
};

async function queryLatestTimelineSnapshot(
  includeAllocations: boolean,
  where?: Prisma.VaultSnapshotWhereInput,
  orderBy?: Prisma.VaultSnapshotOrderByWithRelationInput,
): Promise<Prisma.VaultSnapshotGetPayload<object> | null> {
  const baseWhere = { ...timelineSnapshotWhere(), ...where };
  const baseOrder = orderBy ?? { takenAt: "desc" as const };

  if (includeAllocations) {
    return prisma.vaultSnapshot.findFirst({
      where: baseWhere,
      orderBy: baseOrder,
      include: { allocations: true },
    });
  }

  return prisma.vaultSnapshot.findFirst({
    where: baseWhere,
    orderBy: baseOrder,
  });
}

const fetchTimelineWithAllocations = unstable_cache(
  () => queryLatestTimelineSnapshot(true),
  ["admin-timeline-snapshot", "with-allocations"],
  {
    revalidate: ADMIN_DASHBOARD_REVALIDATE_SEC,
    tags: ["admin-vault-timeline"],
  },
);

const fetchTimelineBare = unstable_cache(
  () => queryLatestTimelineSnapshot(false),
  ["admin-timeline-snapshot", "bare"],
  {
    revalidate: ADMIN_DASHBOARD_REVALIDATE_SEC,
    tags: ["admin-vault-timeline"],
  },
);

/** Request-scoped dedup on top of cross-request timeline cache. */
const loadLatestTimelineSnapshotCached = cache((includeAllocations: boolean) =>
  includeAllocations ? fetchTimelineWithAllocations() : fetchTimelineBare(),
);

/**
 * Latest vault snapshot on the real timeline — shared by dashboard, cockpit,
 * and risk loaders so KPIs never disagree across admin surfaces.
 *
 * Default calls are deduplicated per request via `React.cache`.
 */
export async function loadLatestTimelineSnapshot(
  args: TimelineSnapshotFindArgs & { includeAllocations: true },
): Promise<
  Prisma.VaultSnapshotGetPayload<{ include: { allocations: true } }> | null
>;
export async function loadLatestTimelineSnapshot(
  args?: TimelineSnapshotFindArgs,
): Promise<Prisma.VaultSnapshotGetPayload<object> | null>;
export async function loadLatestTimelineSnapshot(
  args: TimelineSnapshotFindArgs = {},
): Promise<Prisma.VaultSnapshotGetPayload<object> | null> {
  const { includeAllocations, where, orderBy, select } = args;

  if (select) {
    return prisma.vaultSnapshot.findFirst({
      where: { ...timelineSnapshotWhere(), ...where },
      orderBy: orderBy ?? { takenAt: "desc" },
      select,
    });
  }

  if (where || orderBy) {
    return queryLatestTimelineSnapshot(includeAllocations === true, where, orderBy);
  }

  return loadLatestTimelineSnapshotCached(includeAllocations === true);
}
