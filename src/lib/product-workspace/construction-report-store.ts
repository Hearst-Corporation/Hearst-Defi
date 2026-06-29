import "server-only";

import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { ProductConstructionDraft } from "@/lib/agentic/swarm/live/types";
import { parseFormState } from "./form-state";

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

/** Coerce an unknown JSON value to a number, or null when it isn't finite. */
function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
    // Required string identity fields gate the read; the rest are coerced
    // defensively so a partially-written blob still loads (number→0, optional
    // metadata via fallback) instead of being dropped.
    if (
      typeof raw.objective !== "string" ||
      typeof raw.vaultTicker !== "string" ||
      typeof raw.prose !== "string"
    ) {
      return null;
    }
    return {
      objective: raw.objective,
      vaultTicker: raw.vaultTicker,
      vaultLabel: typeof raw.vaultLabel === "string" ? raw.vaultLabel : "",
      headlineLow: num(raw.headlineLow) ?? 0,
      headlineHigh: num(raw.headlineHigh) ?? 0,
      probBelowFloorPct: num(raw.probBelowFloorPct) ?? 0,
      seed: num(raw.seed) ?? 0,
      btcUsd: num(raw.btcUsd) ?? 0,
      hashpriceUsdPerThDay: num(raw.hashpriceUsdPerThDay) ?? 0,
      machineCount: num(raw.machineCount) ?? 0,
      prose: raw.prose,
      llmAuthored: raw.llmAuthored === true,
      updatedAtIso:
        typeof raw.updatedAtIso === "string" ? raw.updatedAtIso : "",
    };
  } catch (err) {
    logger.warn(
      "construction report load failed",
      { userId },
      err instanceof Error ? err : undefined,
    );
    return null;
  }
}
