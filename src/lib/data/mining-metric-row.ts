import "server-only";

import type { MiningMetric } from "@prisma/client";
import { cache } from "react";
import { unstable_cache } from "next/cache";

import { ADMIN_DASHBOARD_REVALIDATE_SEC } from "@/lib/data/admin-dashboard-cache";
import { prisma } from "@/lib/db";

const fetchLatestMiningMetricRow = unstable_cache(
  async (): Promise<MiningMetric | null> =>
    prisma.miningMetric.findFirst({
      orderBy: { takenAt: "desc" },
    }),
  ["admin-latest-mining-metric"],
  {
    revalidate: ADMIN_DASHBOARD_REVALIDATE_SEC,
    tags: ["admin-mining-metric"],
  },
);

/** Latest `MiningMetric` row — cross-request + per-request dedup for admin loaders. */
export const loadLatestMiningMetricRow = cache(
  async (): Promise<MiningMetric | null> => fetchLatestMiningMetricRow(),
);
