/**
 * Wrapper Vitest — GATE HONNÊTETÉ /admin (ratchet).
 *
 * Même mécanisme que scripts/__tests__/assert-prisma-provider-safe.test.mjs :
 * on importe la logique exportée par le CLI (runGate/readBaseline) et on
 * l'exécute en pur — aucun process enfant, aucun I/O au-delà de la lecture du
 * repo. Un it() PAR RÈGLE : hits <= baseline (ratchet). En dépassement, le
 * message liste les file:ligne fautifs pour corriger sans relancer le CLI.
 *
 * La baseline ne se régénère JAMAIS ici : `node scripts/admin-honesty-gate.mjs
 * --update` (refuse une hausse sans --force).
 */

import { describe, expect, it } from "vitest";

import { readBaseline, runGate } from "../admin-honesty-gate.mjs";
import { RULES } from "../admin-honesty-rules.mjs";

// Un seul run pour tous les it() — le scan est pur et déterministe.
const results = runGate();
const baseline = readBaseline();

describe("admin honesty gate — ratchet (hits <= baseline)", () => {
  it("baseline exists and covers every rule (scripts/admin-honesty-baseline.json)", () => {
    for (const rule of RULES) {
      expect(
        baseline.rules?.[rule.id]?.hits,
        `No baseline for rule "${rule.id}" — run: node scripts/admin-honesty-gate.mjs --update`,
      ).toBeTypeOf("number");
    }
  });

  for (const rule of RULES) {
    it(`${rule.id} — no regression beyond baseline`, () => {
      const res = results.find((r) => r.id === rule.id);
      expect(res, `rule "${rule.id}" produced no result`).toBeDefined();
      const limit = baseline.rules?.[rule.id]?.hits ?? Infinity;
      if (res.hits.length > limit) {
        const shown = res.hits
          .map((h) => `  ${h.file}:${h.line}  ${h.message}`)
          .slice(0, 40);
        const more =
          res.hits.length > 40 ? `\n  … +${res.hits.length - 40} more (run: node scripts/admin-honesty-gate.mjs --rule ${rule.id})` : "";
        expect.fail(
          `${rule.id}: ${res.hits.length} hits > baseline ${limit} — you introduced NEW dishonesty. ` +
            `Fix the new hits (never raise the baseline):\n${shown.join("\n")}${more}`,
        );
      }
      expect(res.hits.length).toBeLessThanOrEqual(limit);
    });
  }
});

describe("admin honesty gate — self-consistency", () => {
  it("every allowlist entry carries a written reason", () => {
    for (const rule of RULES) {
      for (const entry of rule.allowlist ?? []) {
        expect(
          typeof entry.reason === "string" && entry.reason.trim().length > 0,
          `allowlist entry for ${entry.file} in rule "${rule.id}" has no written reason`,
        ).toBe(true);
      }
    }
  });

  it("unmarked-fiction allowlist stays EMPTY (a provenance coercion is fixed, never excused)", () => {
    const rule = RULES.find((r) => r.id === "unmarked-fiction");
    expect(rule.allowlist).toEqual([]);
  });
});
