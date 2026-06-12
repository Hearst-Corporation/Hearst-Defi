import "server-only";

import type { Prisma } from "@prisma/client";

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

export function timelineSnapshotWhere(): { source: { in: TimelineSnapshotSource[] } } {
  return { source: { in: [...TIMELINE_SNAPSHOT_SOURCES] } };
}

type TimelineSnapshotFindArgs = {
  includeAllocations?: boolean;
  orderBy?: Prisma.VaultSnapshotOrderByWithRelationInput;
  where?: Prisma.VaultSnapshotWhereInput;
  select?: Prisma.VaultSnapshotSelect;
};

/**
 * Latest vault snapshot on the real timeline — shared by dashboard, cockpit,
 * and risk loaders so KPIs never disagree across admin surfaces.
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

  if (includeAllocations) {
    return prisma.vaultSnapshot.findFirst({
      where: { ...timelineSnapshotWhere(), ...where },
      orderBy: orderBy ?? { takenAt: "desc" },
      include: { allocations: true },
    });
  }

  return prisma.vaultSnapshot.findFirst({
    where: { ...timelineSnapshotWhere(), ...where },
    orderBy: orderBy ?? { takenAt: "desc" },
  });
}
