import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Methodology source-of-truth loader.
 *
 * Two ratified versions coexist:
 *   - v1.0 (rule-based, 2026-05-13, immutable) — default for all rule-based scenarios.
 *   - v2.0 (Monte Carlo extension, 2026-05-22, ratified via ADR-006) — cited when
 *     the agent input is a Monte Carlo output (p5/p50/p95, paths, seed).
 *
 * The draft `v2.1-draft.md` (multi-vault + share classes, 2026-05-26) is NOT loaded
 * here: it is unratified, must not appear in any LP-facing output, and is intentionally
 * excluded from the `MethodologyVersion` literal type so a typo cannot leak it into
 * an agent prompt.
 *
 * We read the markdown at module-load (server side) so:
 *   1) The exact contents are embedded in the system prompt that we cache.
 *   2) Any drift between the doc and the prompt is impossible — they are the same bytes.
 */

/**
 * Ratified methodology versions. The draft (v2.1-draft) is intentionally excluded:
 * agents must never cite an unratified methodology in production outputs.
 */
export type MethodologyVersion = "v1.0" | "v2.0";

const METHODOLOGY_V1_PATH = join(process.cwd(), "docs", "methodology", "v1.0.md");
const METHODOLOGY_V2_PATH = join(process.cwd(), "docs", "methodology", "v2.0.md");

export const METHODOLOGY_V1_MD: string = readFileSync(METHODOLOGY_V1_PATH, "utf8");
export const METHODOLOGY_V2_MD: string = readFileSync(METHODOLOGY_V2_PATH, "utf8");

/**
 * Default methodology citation when the caller does not specify one explicitly.
 * Rule-based engine outputs (`ScenarioOutput`, `BacktestOutput`) are produced
 * under v1.0 and that remains the default everywhere.
 */
export const METHODOLOGY_VERSION: MethodologyVersion = "v1.0";

/**
 * Returns the markdown body matching the requested methodology version.
 * Used by agents to inline the correct source into their system prompt.
 */
export function getMethodologyMd(version: MethodologyVersion): string {
  return version === "v2.0" ? METHODOLOGY_V2_MD : METHODOLOGY_V1_MD;
}
