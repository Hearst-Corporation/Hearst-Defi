/**
 * Tier model — the autonomy router for the Outreach engine.
 *
 * A prospect's qualification score (0-100, from the scorer agent) maps to a
 * tier that decides how far the agent acts on its own:
 *
 *   Tier A "Prime"  — agent drafts only; the human rewrites/sends/follows up.
 *   Tier B "Warm"   — agent sends the first touch; human owns the reply.
 *   Tier C "Cold"   — closed loop: agent sends, follows up, reads, qualifies.
 *   (below tierCMin) — rejected (out of ICP / not worth the credit).
 *
 * The thresholds live on each OutreachICP so different personas can tune them.
 * This module is pure (no DB / no IO) so it is trivially testable and usable on
 * both server and client.
 */

export type Tier = "A" | "B" | "C";

export interface TierThresholds {
  /** score >= tierAMin → Tier A (prime). */
  tierAMin: number;
  /** score >= tierBMin → Tier B (warm). */
  tierBMin: number;
  /** score >= tierCMin → Tier C (cold). Below → rejected. */
  tierCMin: number;
}

/** Agreed defaults (2026-06-20): 85 / 60 / 40. */
export const DEFAULT_TIER_THRESHOLDS: TierThresholds = {
  tierAMin: 85,
  tierBMin: 60,
  tierCMin: 40,
};

/**
 * Maps a score to a tier, or `null` when the score is below `tierCMin`
 * (rejected). Thresholds are clamped into a sane order defensively so a
 * mis-entered ICP (e.g. tierBMin > tierAMin) can never produce a tier that
 * contradicts the ranking.
 */
export function tierForScore(
  score: number,
  thresholds: TierThresholds = DEFAULT_TIER_THRESHOLDS,
): Tier | null {
  const cMin = thresholds.tierCMin;
  const bMin = Math.max(thresholds.tierBMin, cMin);
  const aMin = Math.max(thresholds.tierAMin, bMin);

  if (score >= aMin) return "A";
  if (score >= bMin) return "B";
  if (score >= cMin) return "C";
  return null;
}

/** Human label per tier, for UI + chat copy. */
export const TIER_LABEL: Record<Tier, string> = {
  A: "Prime",
  B: "Warm",
  C: "Cold",
};

/**
 * What the agent is allowed to do for a tier, in one line — surfaced in the UI
 * and the copilot so the operator always sees the autonomy contract.
 */
export const TIER_AUTONOMY: Record<Tier, string> = {
  A: "Agent drafts — you rewrite & send",
  B: "Agent sends first touch — you own replies",
  C: "Closed loop — agent sends, follows up, qualifies",
};

/** Badge variant per tier, aligned to the existing Badge component variants. */
export const TIER_BADGE_VARIANT: Record<Tier, "success" | "accent" | "default"> =
  {
    A: "success",
    B: "accent",
    C: "default",
  };

/** Type guard for a raw string coming from the DB / a form. */
export function isTier(value: unknown): value is Tier {
  return value === "A" || value === "B" || value === "C";
}

/**
 * Promotes a tier one step toward Prime (C→B→A). Used when a Cold/Warm lead
 * replies positively: it climbs back toward the operator's hands. A is the cap.
 */
export function promoteTier(current: Tier): Tier {
  if (current === "C") return "B";
  if (current === "B") return "A";
  return "A";
}
