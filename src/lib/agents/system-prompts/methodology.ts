import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Methodology source-of-truth loader.
 *
 * Three ratified versions coexist:
 *   - v1.0 (rule-based, 2026-05-13, immutable) — the distributed-yield model.
 *   - v2.0 (Monte Carlo extension, 2026-05-22, ratified via ADR-006) — cited when
 *     the agent input is a Monte Carlo output (p5/p50/p95, paths, seed).
 *   - v3.0 (mining note, 2026-07-15, ratified via ADR-019) — **the active
 *     methodology** and the default citation for the current product.
 *
 * v1.0 and v2.0 stay loadable on purpose: they are immutable, on-file records
 * (ADR-019 §7). A memo generated under an earlier version keeps its original
 * `methodology_version` and is never retroactively rewritten, so an explicit
 * caller must still be able to re-cite the exact bytes it was produced under.
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
export type MethodologyVersion = "v1.0" | "v2.0" | "v3.0";

const METHODOLOGY_V1_PATH = join(process.cwd(), "docs", "methodology", "v1.0.md");
const METHODOLOGY_V2_PATH = join(process.cwd(), "docs", "methodology", "v2.0.md");
const METHODOLOGY_V3_PATH = join(process.cwd(), "docs", "methodology", "v3.0.md");

export const METHODOLOGY_V1_MD: string = readFileSync(METHODOLOGY_V1_PATH, "utf8");
export const METHODOLOGY_V2_MD: string = readFileSync(METHODOLOGY_V2_PATH, "utf8");
export const METHODOLOGY_V3_MD: string = readFileSync(METHODOLOGY_V3_PATH, "utf8");

/**
 * Default methodology citation when the caller does not specify one explicitly.
 * The active product is the mining note, governed by v3.0 (ADR-019), so v3.0 is
 * the default everywhere. Callers re-citing a historical output pass its own
 * version explicitly.
 */
export const METHODOLOGY_VERSION: MethodologyVersion = "v3.0";

/**
 * Returns the markdown body matching the requested methodology version.
 * Used by agents to inline the correct source into their system prompt.
 */
export function getMethodologyMd(version: MethodologyVersion): string {
  if (version === "v3.0") return METHODOLOGY_V3_MD;
  return version === "v2.0" ? METHODOLOGY_V2_MD : METHODOLOGY_V1_MD;
}
