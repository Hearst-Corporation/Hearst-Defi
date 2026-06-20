/**
 * Outreach send policy — the autonomy router for the SEND side (ADR-016).
 *
 * Pure functions, no DB / no IO, so the whole "may this email leave the
 * building, and under what budget" decision is trivially testable and lives in
 * exactly one place. The DB-touching auto-send job (`outreach-auto-send.ts`)
 * supplies the live counters; this module only decides.
 *
 * Two questions it answers:
 *   1. `decideAutoSend(tier, autonomy, kind)` — is a given prospect eligible for
 *      an AUTONOMOUS send at the current autonomy level?  (Tier A → never.)
 *   2. `effectiveDailyCap(...)` / `remainingDailyBudget(...)` — how many auto
 *      sends are still allowed today, given the warm-up curve and the hard cap.
 *
 * Invariants enforced here (mirror ADR-016):
 *   - Tier A is NEVER auto-sent at any autonomy level. The agent drafts + alerts.
 *   - SUGGEST never auto-sends anything (the default, safe posture).
 *   - First-touch auto sends require SEND+. Follow-ups require NURTURE+.
 *   - Reply-driven actions require CLOSED (handled in the reply-handler, but the
 *     autonomy ordering is defined here so there is one source of truth).
 */

import type { Tier } from "@/lib/outreach/tier";

/** Autonomy ceiling — mirrors `OUTREACH_AUTONOMY` in `src/lib/env.ts`. */
export type Autonomy = "SUGGEST" | "SEND" | "NURTURE" | "CLOSED";

/** Ordered low→high so we can compare ceilings numerically. */
const AUTONOMY_RANK: Record<Autonomy, number> = {
  SUGGEST: 0,
  SEND: 1,
  NURTURE: 2,
  CLOSED: 3,
};

/** True when `level` is at least `min` in the autonomy ordering. */
export function autonomyAtLeast(level: Autonomy, min: Autonomy): boolean {
  return AUTONOMY_RANK[level] >= AUTONOMY_RANK[min];
}

/** What an auto-send job is trying to do for a prospect. */
export type SendKind = "first_touch" | "follow_up";

export interface SendDecision {
  /** Whether the agent may send this WITHOUT per-email human approval. */
  autoSend: boolean;
  /**
   * When `autoSend` is false but the lead still warrants action, this flags that
   * the operator should be alerted to draft/send by hand (Tier A prime path).
   */
  alertOperator: boolean;
  /** Human-readable reason — surfaced in audit + the admin UI. */
  reason: string;
}

/**
 * Decide whether a prospect of `tier` may be auto-sent a `kind` email at the
 * current `autonomy` level. The single authority for the tier × autonomy matrix.
 *
 * | autonomy | A            | B (first) | C (first) | B/C (follow-up) |
 * |----------|--------------|-----------|-----------|-----------------|
 * | SUGGEST  | draft+alert  | no        | no        | no              |
 * | SEND     | draft+alert  | YES       | YES       | no              |
 * | NURTURE+ | draft+alert  | YES       | YES       | YES             |
 */
export function decideAutoSend(
  tier: Tier,
  autonomy: Autonomy,
  kind: SendKind,
): SendDecision {
  // Tier A is never auto-sent — too valuable to spend on an unreviewed template.
  if (tier === "A") {
    return {
      autoSend: false,
      alertOperator: autonomyAtLeast(autonomy, "SEND"),
      reason:
        autonomy === "SUGGEST"
          ? "Tier A (Prime) — draft only; human sends (SUGGEST)"
          : "Tier A (Prime) — never auto-sent; operator alerted to send",
    };
  }

  // First touch (B/C) requires SEND or higher.
  if (kind === "first_touch") {
    if (autonomyAtLeast(autonomy, "SEND")) {
      return {
        autoSend: true,
        alertOperator: false,
        reason: `Tier ${tier} first touch — auto-send (${autonomy})`,
      };
    }
    return {
      autoSend: false,
      alertOperator: false,
      reason: `Tier ${tier} first touch held — autonomy is SUGGEST`,
    };
  }

  // Follow-ups (B/C) require NURTURE or higher.
  if (autonomyAtLeast(autonomy, "NURTURE")) {
    return {
      autoSend: true,
      alertOperator: false,
      reason: `Tier ${tier} follow-up — auto-send (${autonomy})`,
    };
  }
  return {
    autoSend: false,
    alertOperator: false,
    reason: `Tier ${tier} follow-up held — autonomy below NURTURE`,
  };
}

// ---------------------------------------------------------------------------
// Daily volume governor — warm-up curve + hard cap.
// ---------------------------------------------------------------------------

/**
 * Warm-up curve. A cold sending domain must not be blasted on day one or the
 * reputation tanks. The effective cap ramps from a low floor up to the
 * configured `OUTREACH_DAILY_SEND_CAP` over `WARMUP_DAYS`, roughly doubling each
 * step — the classic deliverability warm-up shape.
 *
 * day 0 → floor; then floor*2, floor*4, … clamped to the configured cap.
 */
const WARMUP_FLOOR = 10;
const WARMUP_DAYS = 14;

/**
 * Effective per-day auto-send cap given how many days the domain has been
 * sending. `dayIndex` is 0 on the first sending day. The result never exceeds
 * the configured hard cap and never drops below the floor (or the cap, if the
 * cap is itself below the floor — a deliberately tiny cap wins).
 */
export function effectiveDailyCap(configuredCap: number, dayIndex: number): number {
  const safeCap = Math.max(0, Math.floor(configuredCap));
  if (safeCap === 0) return 0;
  if (dayIndex >= WARMUP_DAYS) return safeCap;

  // Geometric ramp: floor * 2^dayIndex, clamped to the configured cap.
  const ramped = WARMUP_FLOOR * 2 ** Math.max(0, Math.floor(dayIndex));
  return Math.min(safeCap, Math.max(Math.min(WARMUP_FLOOR, safeCap), ramped));
}

/**
 * How many auto sends remain allowed today. `sentToday` is the count already
 * dispatched this UTC day; the result is clamped to [0, cap].
 */
export function remainingDailyBudget(
  configuredCap: number,
  dayIndex: number,
  sentToday: number,
): number {
  const cap = effectiveDailyCap(configuredCap, dayIndex);
  return Math.max(0, cap - Math.max(0, Math.floor(sentToday)));
}

// ---------------------------------------------------------------------------
// Queue ordering — Prime > Warm > Cold, then oldest-contacted first.
// ---------------------------------------------------------------------------

/** Priority weight per tier for the send queue (higher = sent sooner). */
const TIER_PRIORITY: Record<Tier, number> = { A: 3, B: 2, C: 1 };

export interface QueueItemLike {
  tier: Tier;
  /** Epoch ms of the last contact, or null when never contacted. */
  lastContactedMs: number | null;
}

/**
 * Comparator for the send queue: Prime first, then never-contacted before
 * stale, then oldest-contacted first (fairness — don't starve old leads).
 * Stable and pure; usable directly in `Array.prototype.sort`.
 */
export function compareQueue(a: QueueItemLike, b: QueueItemLike): number {
  const byTier = TIER_PRIORITY[b.tier] - TIER_PRIORITY[a.tier];
  if (byTier !== 0) return byTier;
  // never-contacted (null) sorts before contacted
  const am = a.lastContactedMs ?? -1;
  const bm = b.lastContactedMs ?? -1;
  return am - bm;
}
