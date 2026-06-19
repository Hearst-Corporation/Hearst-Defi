/**
 * Outreach copilot — intent classifier.
 *
 * Maps a free-text operator message to a bounded set of intents the copilot can
 * act on. Palier 0 uses deterministic keyword matching (no LLM, no cost, fully
 * testable). The Palier-1 upgrade swaps/augments this with the GPT-4.1 client
 * for fuzzy understanding + ICP authoring from natural language — but the intent
 * vocabulary (and therefore the action surface) stays the same, so the route
 * handler does not change.
 *
 * Pure module (no IO) — importable by the route and by unit tests.
 */

export type OutreachIntent =
  | { kind: "source"; count: number } //   "find / source N leads"
  | { kind: "show_tier"; tier: "A" | "B" | "C" } // "show prime / tier A"
  | { kind: "stats" } //                    "how many prospects / status"
  | { kind: "help" } //                     fallback / "what can you do"
  | { kind: "unknown"; text: string }; //   nothing matched

/** Extracts the first integer from the text and clamps it to 1..50. */
function extractCount(text: string, fallback = 12): number {
  const m = text.match(/\b(\d{1,5})\b/);
  if (!m || m[1] === undefined) return fallback;
  const n = Number.parseInt(m[1], 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(Math.max(n, 1), 50);
}

const SOURCE_RE =
  /\b(source|sourcer|find|trouve|trouver|cherche|chercher|prospect|leads?|g[ée]n[èe]re)\b/i;
const STATS_RE =
  /\b(stat|stats|status|combien|how many|count|pipeline|funnel|overview|r[ée]sum[ée])\b/i;
const HELP_RE =
  /\b(help|aide|aider|what can you|que peux|comment [çc]a marche|commands?)\b/i;

/** Tier keywords → tier letter. */
function matchTier(text: string): "A" | "B" | "C" | null {
  const t = text.toLowerCase();
  if (/\b(tier\s*a|prime|high.?value|chaud|best)\b/.test(t)) return "A";
  if (/\b(tier\s*b|warm|ti[èe]de|mid)\b/.test(t)) return "B";
  if (/\b(tier\s*c|cold|froid|low)\b/.test(t)) return "C";
  return null;
}

/**
 * Classify a message into an intent. Order matters: explicit "show tier X" and
 * "source" win over the generic stats/help nets. An empty message → help.
 */
export function classifyOutreachIntent(raw: string): OutreachIntent {
  const text = raw.trim();
  if (text.length === 0) return { kind: "help" };

  const tier = matchTier(text);
  // An explicit display verb means "show me a tier", even if the noun "leads"
  // (which also triggers SOURCE_RE) is present — e.g. "show the prime leads".
  const hasShowVerb =
    /\b(show|montre|montrer|list|liste|voir|display|qui|who)\b/i.test(text);

  // Display verb + a tier wins over sourcing (it's a read, not an action).
  if (tier && hasShowVerb) {
    return { kind: "show_tier", tier };
  }
  // Otherwise an explicit source verb is the action.
  if (SOURCE_RE.test(text)) {
    return { kind: "source", count: extractCount(text) };
  }
  // A bare tier mention with no source verb ("tier B", "the cold ones").
  if (tier) {
    return { kind: "show_tier", tier };
  }
  if (STATS_RE.test(text)) {
    return { kind: "stats" };
  }
  if (HELP_RE.test(text)) {
    return { kind: "help" };
  }
  return { kind: "unknown", text };
}
