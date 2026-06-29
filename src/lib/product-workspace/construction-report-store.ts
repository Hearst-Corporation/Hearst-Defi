import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";

/**
 * Persist the latest construction report into the EXISTING `VaultDraft` row
 * (no new table). The report lives alongside the product-workspace state under a
 * dedicated `constructionReport` key in `formState`, so a refresh re-displays the
 * last report and the admin keeps a per-admin record of what was constructed.
 *
 * A construction report is an informational artifact, NOT a custodial/deploy
 * action — persisting it does not create, send, or deploy anything. The blob is
 * bounded (prose capped) so it can never bloat the JSON column.
 */

const REPORT_KEY = "constructionReport";
const MAX_PROSE_LEN = 8_000;

/** The compact, bounded report we store (the draft minus the heavy raw chart
 *  point arrays, which the workspace can recompute on a fresh run). */
export interface StoredConstructionReport {
  objective: string;
  vaultTicker: string;
  vaultLabel: string;
  headlineLow: number;
  headlineHigh: number;
  probBelowFloorPct: number;
  seed: number;
  btcUsd: number;
  hashpriceUsdPerThDay: number;
  machineCount: number;
  prose: string;
  llmAuthored: boolean;
  updatedAtIso: string;
}

function toStored(
  draft: ProductConstructionDraft,
  now: Date,
): StoredConstructionReport {
  return {
    objective: draft.objective,
    vaultTicker: draft.vault.ticker,
    vaultLabel: draft.vault.label,
    headlineLow: draft.quant.headlineRange.low,
    headlineHigh: draft.quant.headlineRange.high,
    probBelowFloorPct: draft.quant.probBelowFloorPct,
    seed: draft.quant.seed,
    btcUsd: draft.market.btcUsd,
    hashpriceUsdPerThDay: draft.market.hashpriceUsdPerThDay,
    machineCount: draft.telegram.machineCount,
    prose: draft.writeup.prose.slice(0, MAX_PROSE_LEN),
    llmAuthored: draft.writeup.llmAuthored,
    updatedAtIso: now.toISOString(),
  };
}

function parseFormState(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** Best-effort persist — a failed write never breaks the response path. */
export async function saveConstructionReport(args: {
  userId: string;
  draft: ProductConstructionDraft;
  now?: Date;
}): Promise<void> {
  const stored = toStored(args.draft, args.now ?? new Date());
  try {
    const existing = await prisma.vaultDraft.findUnique({
      where: { userId: args.userId },
    });
    const merged = {
      ...parseFormState(existing?.formState),
      [REPORT_KEY]: stored,
    };
    await prisma.vaultDraft.upsert({
      where: { userId: args.userId },
      create: {
        userId: args.userId,
        formState: JSON.stringify(merged),
        step: "product-workspace",
      },
      update: {
        formState: JSON.stringify(merged),
        step: existing?.step ?? "product-workspace",
      },
    });
  } catch (err) {
    logger.warn(
      "construction report persist failed",
      { userId: args.userId },
      err instanceof Error ? err : undefined,
    );
  }
}

/** Load the last stored report for an admin (null when none / on error). */
export async function loadConstructionReport(
  userId: string,
): Promise<StoredConstructionReport | null> {
  try {
    const row = await prisma.vaultDraft.findUnique({ where: { userId } });
    const state = parseFormState(row?.formState);
    const r = state[REPORT_KEY];
    if (!r || typeof r !== "object" || Array.isArray(r)) return null;
    const raw = r as Record<string, unknown>;
    if (
      typeof raw.objective !== "string" ||
      typeof raw.vaultTicker !== "string" ||
      typeof raw.prose !== "string"
    ) {
      return null;
    }
    return raw as unknown as StoredConstructionReport;
  } catch (err) {
    logger.warn(
      "construction report load failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return null;
  }
}
