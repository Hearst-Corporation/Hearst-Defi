/**
 * Strategy matching engine — PURE, DETERMINISTIC, no LLM.
 *
 * Scores each ACTIVE strategy against a structured request (family / risk /
 * priority / horizon) plus an optional free-text note. Structured signals weigh
 * far more than note keywords. The highest score wins; ties break by a stable
 * order (config order). When nothing clears the bar, the single active fallback
 * is returned with `fallbackUsed: true`.
 */

import type {
  ProductStrategy,
  StrategySelectionRequest,
  StrategySelectionResult,
} from "./types";
import { getFallbackStrategy } from "./strategies.config";

// Weights — structured selections dominate the note.
const W_FAMILY = 40;
const W_RISK = 20;
const W_PRIORITY = 20;
const W_HORIZON = 10;
const W_KEYWORD = 6; // per matched keyword (note), capped
const KEYWORD_CAP = 18;

function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

interface Scored {
  strategy: ProductStrategy;
  score: number;
  matchedRules: string[];
}

function scoreStrategy(
  strategy: ProductStrategy,
  req: StrategySelectionRequest,
): Scored {
  const rules = strategy.selectionRules;
  const matchedRules: string[] = [];
  let score = 0;

  if (req.productFamily && rules.productFamilies.includes(req.productFamily as never)) {
    score += W_FAMILY;
    matchedRules.push(`family:${req.productFamily}`);
  }
  if (req.riskProfile && rules.riskProfiles.includes(req.riskProfile as never)) {
    score += W_RISK;
    matchedRules.push(`risk:${req.riskProfile}`);
  }
  if (req.priority && rules.priorities.includes(req.priority as never)) {
    score += W_PRIORITY;
    matchedRules.push(`priority:${req.priority}`);
  }
  if (
    typeof req.horizonMonths === "number" &&
    req.horizonMonths === strategy.defaultHorizonMonths
  ) {
    score += W_HORIZON;
    matchedRules.push(`horizon:${req.horizonMonths}m`);
  }

  // Note keywords (weakest signal, capped).
  if (req.note && rules.keywords.length > 0) {
    const note = normalise(req.note);
    let kwScore = 0;
    for (const kw of rules.keywords) {
      if (note.includes(normalise(kw))) {
        kwScore = Math.min(KEYWORD_CAP, kwScore + W_KEYWORD);
        matchedRules.push(`keyword:${kw}`);
      }
    }
    score += kwScore;
  }

  return { strategy, score, matchedRules };
}

/**
 * Select the best-matching active strategy for a request. Deterministic; returns
 * the active fallback when no active strategy scores above zero (or clears its
 * own minConfidence proxy on note-only matches).
 */
export function selectProductStrategy(
  request: StrategySelectionRequest,
  strategies: ProductStrategy[],
): StrategySelectionResult {
  const active = strategies.filter((s) => s.status === "active");
  const fallback = getFallbackStrategy(strategies);

  if (active.length === 0) {
    return { strategy: fallback, score: 0, matchedRules: [], fallbackUsed: true };
  }

  // Score every active non-fallback strategy (the fallback is the safety net).
  const scored = active
    .filter((s) => !s.isFallback)
    .map((s) => scoreStrategy(s, request))
    // Stable order preserved from input for deterministic tie-breaks.
    .sort((a, b) => b.score - a.score);

  const best = scored[0];

  // A specific (non-fallback) strategy may only win on a DISCRIMINATING signal —
  // its product family OR a keyword. Risk / priority / horizon alone are refiners,
  // not selectors (otherwise "balanced" would match every strategy). A note-only
  // match must additionally clear the strategy's minConfidence, expressed as the
  // share of the KEYWORD ceiling that matched.
  const familyMatched = best ? best.matchedRules.some((r) => r.startsWith("family:")) : false;
  const keywordHits = best
    ? best.matchedRules.filter((r) => r.startsWith("keyword:")).length
    : 0;
  const noteConfidence = keywordHits > 0 ? Math.min(1, (keywordHits * W_KEYWORD) / KEYWORD_CAP) : 0;
  const noteOk = best ? keywordHits > 0 && noteConfidence >= best.strategy.selectionRules.minConfidence : false;

  if (best && best.score > 0 && (familyMatched || noteOk)) {
    return {
      strategy: best.strategy,
      score: best.score,
      matchedRules: best.matchedRules,
      fallbackUsed: false,
    };
  }

  return { strategy: fallback, score: best?.score ?? 0, matchedRules: [], fallbackUsed: true };
}
