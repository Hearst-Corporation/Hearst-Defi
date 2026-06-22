import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { NAV_DESTINATIONS } from "@/lib/llm/navigate-tool";
import {
  NAV_KEYWORDS,
  resolveLpNavDestinationKey,
  resolveAdminNavFallbackKey,
} from "@/lib/llm/nav-fallback-intent";

/**
 * MASSIVE deterministic regex stress loop for the nav fallback resolvers.
 *
 * Pure regex, no LLM, no I/O — CI-safe and free. Builds a cartesian positive
 * corpus (verbs x keywords), a negative corpus (conversational Q&A + sensitive
 * mutating intents), then loops the whole thing >10k times asserting identical
 * results each pass (no state leak, no perf cliff). Emits a parseable JSON line.
 */

const VERBS = [
  "ouvre",
  "va sur",
  "montre-moi",
  "go to",
  "show",
  "affiche",
  "open",
  "take me to",
] as const;

// Keys that are real navigation destinations (so we can sanity-check that a
// resolved key is in the right profile space). admin- prefix => admin profile.
const ADMIN_DEST_KEYS = new Set(
  NAV_DESTINATIONS.filter((d) => d.profile === "admin").map((d) => d.key),
);
const LP_DEST_KEYS = new Set(
  NAV_DESTINATIONS.filter((d) => d.profile === "lp").map((d) => d.key),
);

interface PositiveCase {
  phrase: string;
  bucket: "admin" | "lp";
  sourceKey: string;
  keyword: string;
}

function isAdminKey(key: string): boolean {
  return key.startsWith("admin-");
}

// Build the positive corpus: every (verb x keyword) pair, bucketed by whether
// the keyword's destination key is an admin destination.
function buildPositiveCorpus(): PositiveCase[] {
  const cases: PositiveCase[] = [];
  for (const [destKey, keywords] of Object.entries(NAV_KEYWORDS)) {
    const bucket: "admin" | "lp" = isAdminKey(destKey) ? "admin" : "lp";
    for (const keyword of keywords) {
      for (const verb of VERBS) {
        cases.push({
          phrase: `${verb} ${keyword}`,
          bucket,
          sourceKey: destKey,
          keyword,
        });
      }
    }
  }
  return cases;
}

// Negative corpus: conversational Q&A WITHOUT a nav verb, plus sensitive
// mutating intents. Both LP and admin resolvers must return null.
const NEGATIVE_CONVERSATIONAL = [
  "je ne comprends pas mes distributions",
  "explique le yield",
  "quel est le lock-up",
  "what is the APY range",
  "comment fonctionne le vault",
  "pourquoi mon rendement a baissé",
  "c'est quoi la fiscalité sur les coupons",
  "peux-tu m'expliquer la preuve de réserve",
  "what does proof of reserve mean",
  "je m'interroge sur mon allocation",
  "tell me about the governance process",
  "résume-moi les performances de ce trimestre",
] as const;

const NEGATIVE_SENSITIVE = [
  "withdraw my funds",
  "send payout",
  "execute distribution",
  "deploy the vault",
  "retire mes fonds",
  "envoie le paiement",
  "exécute la distribution",
  "transfère mon capital",
  "approve the withdrawal",
  "liquide ma position maintenant",
] as const;

interface NegativeCase {
  phrase: string;
  kind: "conversational" | "sensitive";
}

function buildNegativeCorpus(): NegativeCase[] {
  return [
    ...NEGATIVE_CONVERSATIONAL.map(
      (phrase): NegativeCase => ({ phrase, kind: "conversational" }),
    ),
    ...NEGATIVE_SENSITIVE.map(
      (phrase): NegativeCase => ({ phrase, kind: "sensitive" }),
    ),
  ];
}

describe("nav fallback resolvers — MASSIVE deterministic regex stress loop", () => {
  it("runs 10k+ iterations: stable, no state leak, measured match-rate", () => {
    const positive = buildPositiveCorpus();
    const negative = buildNegativeCorpus();
    const corpusSize = positive.length + negative.length;

    // Repeat the corpus enough times to exceed 10k resolver calls.
    const TARGET = 10000;
    const repeats = Math.ceil(TARGET / corpusSize);
    const iterations = repeats * corpusSize;

    let positiveMatches = 0;
    let falseNegatives = 0;
    let falsePositives = 0;
    let falsePositivesSensitive = 0;
    let falsePositivesBenign = 0;

    // Determinism witnesses: result of the first pass, compared on every later pass.
    const firstPositiveResults = new Map<string, string | null>();
    const firstNegativeResults = new Map<string, string | null>();

    const sampleFailures: string[] = [];
    const pushSample = (msg: string) => {
      if (sampleFailures.length < 8) sampleFailures.push(msg);
    };

    let determinismBreaks = 0;

    for (let pass = 0; pass < repeats; pass++) {
      // ---- positive corpus ----
      for (const c of positive) {
        const got =
          c.bucket === "admin"
            ? resolveAdminNavFallbackKey(c.phrase)
            : resolveLpNavDestinationKey(c.phrase);

        if (pass === 0) {
          firstPositiveResults.set(c.phrase, got);

          if (got === null) {
            falseNegatives++;
            pushSample(
              `[FN ${c.bucket}] "${c.phrase}" expected non-null (src=${c.sourceKey}) got=null`,
            );
          } else {
            positiveMatches++;
            // Cross-profile sanity: an admin-bucket phrase must resolve to an
            // admin-space key and vice-versa.
            const resolvedAdmin = isAdminKey(got);
            const inProfile =
              c.bucket === "admin"
                ? resolvedAdmin && ADMIN_DEST_KEYS.has(got)
                : !resolvedAdmin && LP_DEST_KEYS.has(got);
            if (!inProfile) {
              pushSample(
                `[PROFILE-MISMATCH ${c.bucket}] "${c.phrase}" src=${c.sourceKey} got=${got}`,
              );
            }
          }
        } else {
          // Determinism: must equal the first pass exactly.
          if (firstPositiveResults.get(c.phrase) !== got) {
            determinismBreaks++;
            pushSample(
              `[NONDETERMINISTIC ${c.bucket}] "${c.phrase}" pass0=${firstPositiveResults.get(
                c.phrase,
              )} pass${pass}=${got}`,
            );
          }
        }
      }

      // ---- negative corpus (both resolvers must say null) ----
      for (const n of negative) {
        const lp = resolveLpNavDestinationKey(n.phrase);
        const admin = resolveAdminNavFallbackKey(n.phrase);
        const got = lp ?? admin; // non-null from EITHER resolver = false positive

        if (pass === 0) {
          firstNegativeResults.set(n.phrase, got);
          if (got !== null) {
            falsePositives++;
            if (n.kind === "sensitive") falsePositivesSensitive++;
            else falsePositivesBenign++;
            pushSample(
              `[FP ${n.kind}] "${n.phrase}" expected null got=${got} (lp=${lp} admin=${admin})`,
            );
          }
        } else {
          if (firstNegativeResults.get(n.phrase) !== got) {
            determinismBreaks++;
            pushSample(
              `[NONDETERMINISTIC neg] "${n.phrase}" pass0=${firstNegativeResults.get(
                n.phrase,
              )} pass${pass}=${got}`,
            );
          }
        }
      }
    }

    const totalPositive = positive.length;
    const matchRatePct =
      totalPositive === 0
        ? 0
        : Math.round((positiveMatches / totalPositive) * 10000) / 100;

    const result = {
      iterations,
      repeats,
      corpusSize,
      positiveCorpusSize: positive.length,
      negativeCorpusSize: negative.length,
      positiveMatches,
      matchRatePct,
      falsePositives,
      falsePositivesSensitive,
      falsePositivesBenign,
      falseNegatives,
      determinismBreaks,
      sampleFailures,
    };

    // Emit a single parseable JSON line (visible when vitest prints console).
    // eslint-disable-next-line no-console
    console.log("STRESS_RESULT " + JSON.stringify(result));

    // Also persist to an artifact file (robust against console interception).
    try {
      writeFileSync(
        resolve(process.cwd(), "scripts/stress/last-result.json"),
        JSON.stringify(result, null, 2),
        "utf8",
      );
    } catch {
      // best-effort; the console line is the primary channel.
    }

    // Hard invariants:
    // 1. Loop actually exceeded 10k resolver iterations.
    expect(iterations).toBeGreaterThanOrEqual(TARGET);
    // 2. Pure-function determinism across every repeat.
    expect(determinismBreaks).toBe(0);
    // 3. Sensitive mutating intents must NEVER resolve to a nav key (P0).
    expect(falsePositivesSensitive).toBe(0);
  });
});
