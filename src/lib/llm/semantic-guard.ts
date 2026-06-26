import "server-only";

import { env } from "@/lib/env";
import { huggingface, HF_AVAILABLE, HF_ZEROSHOT_MODEL } from "@/lib/llm/huggingface";

/**
 * SEMANTIC compliance guard — a SECOND screen behind the keyword guard
 * (`src/lib/agents/forbidden-words.ts`), which it NEVER replaces.
 *
 * Why: the keyword guard is regex/needle-based. It is fast, deterministic and
 * the canonical authority — but blind to PARAPHRASE. "your capital is fully
 * protected against any downside" / "vous toucherez vos 12% quoi qu'il arrive"
 * contain no forbidden needle yet are exactly the kind of return-promise that
 * Non-négociable #5 forbids. This module catches those via zero-shot NLI
 * (entailment): we ask a multilingual model "does this text promise/guarantee a
 * return?" — independent of the words used.
 *
 * Contract (defense in depth, fail-safe):
 *  - The keyword guard runs first, synchronously, and stays the hard guarantee.
 *  - This layer is OPTIONAL and network-bound (HF). It NEVER degrades behaviour
 *    when HF is unavailable or errors: it returns `null` (no semantic verdict)
 *    so the caller falls back to "keyword-guard only".
 *  - Driven by env SEMANTIC_GUARD:
 *      absent / "0"      → not invoked at all (callers skip it)
 *      "1" / "shadow"    → run, LOG divergences vs keyword guard, never block
 *      "enforce"         → run, and a positive verdict is a real violation
 *
 * `server-only`: this module performs network I/O with a secret token.
 */

/** Zero-shot hypotheses describing a non-compliant yield/loss claim (EN+FR). */
export const RETURN_PROMISE_HYPOTHESES: readonly string[] = [
  "This text promises or guarantees an investment return.",
  "This text claims the capital cannot lose value or is protected from loss.",
  "This text presents a future yield as certain rather than as a range or estimate.",
  "Ce texte promet ou garantit un rendement.",
  "Ce texte affirme que le capital ne peut pas perdre de valeur.",
] as const;

/** Score above which a hypothesis counts as a semantic compliance hit. */
export const SEMANTIC_GUARD_THRESHOLD = 0.85;

/** Network timeout for the HF call (ms). Short: this is a best-effort 2nd screen. */
const HF_TIMEOUT_MS = 4000;

export type SemanticGuardMode = "off" | "shadow" | "enforce";

/** Resolve the configured mode from env (single source of truth). */
export function semanticGuardMode(): SemanticGuardMode {
  switch (env.SEMANTIC_GUARD) {
    case "enforce":
      return "enforce";
    case "1":
    case "shadow":
      return "shadow";
    default:
      return "off";
  }
}

export interface SemanticGuardVerdict {
  /** True when at least one hypothesis scored ≥ threshold. */
  flagged: boolean;
  /** Best-scoring hypothesis label. */
  topLabel: string;
  /** Best score in [0,1]. */
  topScore: number;
}

/**
 * Run the zero-shot NLI screen on a piece of human-facing text.
 *
 * Returns `null` when no semantic verdict could be produced (HF disabled,
 * no token, empty text, or any network/model error) — callers MUST treat
 * `null` as "no opinion" and keep relying on the keyword guard. Never throws.
 */
export async function classifyReturnPromise(
  text: string,
): Promise<SemanticGuardVerdict | null> {
  const trimmed = text?.trim() ?? "";
  if (!trimmed || !HF_AVAILABLE) return null;

  try {
    const out = await huggingface.zeroShotClassification(
      {
        model: HF_ZEROSHOT_MODEL,
        inputs: trimmed,
        parameters: {
          candidate_labels: [...RETURN_PROMISE_HYPOTHESES],
          multi_label: true,
        },
      },
      { signal: AbortSignal.timeout(HF_TIMEOUT_MS) },
    );

    // Output is an array of { label, score }. Find the strongest hit.
    const elements = Array.isArray(out) ? out : [];
    let topLabel = "";
    let topScore = 0;
    for (const el of elements) {
      const score = typeof el?.score === "number" ? el.score : 0;
      if (score > topScore) {
        topScore = score;
        topLabel = typeof el?.label === "string" ? el.label : "";
      }
    }

    return {
      flagged: topScore >= SEMANTIC_GUARD_THRESHOLD,
      topLabel,
      topScore,
    };
  } catch {
    // Fail-open: network/model failure must not degrade the keyword guard.
    return null;
  }
}

/**
 * Shadow-aware entry point used by callers that already ran the keyword guard.
 *
 * @param text            the human-facing output being checked
 * @param keywordViolated whether the keyword guard already flagged it
 * @returns in "enforce" mode: true iff the semantic layer flags a NEW violation
 *          the keyword guard missed. In "shadow"/"off": always false (never
 *          blocks) — but in "shadow" it logs divergences for calibration.
 */
export async function semanticViolationBeyondKeywords(
  text: string,
  keywordViolated: boolean,
): Promise<boolean> {
  const mode = semanticGuardMode();
  if (mode === "off") return false;

  const verdict = await classifyReturnPromise(text);
  if (!verdict) return false;

  // Divergence = the semantic layer sees a promise the keyword guard missed.
  const divergence = verdict.flagged && !keywordViolated;

  if (mode === "shadow") {
    if (divergence) {
      // Calibration signal only — never block in shadow. Text is NOT logged
      // verbatim (could be investor-facing); only the verdict + a length.
      console.warn(
        "[semantic-guard:shadow] paraphrased return-promise missed by keyword guard",
        {
          topLabel: verdict.topLabel,
          topScore: Number(verdict.topScore.toFixed(3)),
          textLength: text.trim().length,
        },
      );
    }
    return false;
  }

  // enforce
  return divergence;
}
