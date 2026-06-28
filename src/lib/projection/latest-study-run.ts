import "server-only";

import { prisma } from "@/lib/db";

/**
 * latest-study-run.ts — server-only loader for the most recent ProjectionStudyRun.
 *
 * Powers /admin/projection/preview "Mode A" (real latest run). When a run exists
 * we surface its identity + the first ScenarioRun's headline outputs, with HONEST
 * provenance: a real run is "Latest ProjectionStudyRun", never "live"/"audited"/
 * "investor-ready". When no run exists, the caller falls back to the demo fixture
 * (Mode B). Never throws — returns null on any DB/parse failure so the page still
 * renders the fixture instead of breaking.
 */

export interface LatestStudyRunSummary {
  /** ProjectionStudyRun id. */
  id: string;
  /** Short id for compact display. */
  shortId: string;
  ranAt: string;
  label: string | null;
  methodologyVersion: string;
  /** Number of scenario runs in the study (matrix size). */
  scenarioRunCount: number;
  /** Headline APY range from the first scenario run, if parseable. */
  apyRange: { low: number; high: number } | null;
  /** Risk score from the first scenario run, if present. */
  riskScore: number | null;
  /** Vault mode from the first scenario run, if present. */
  mode: string | null;
  /** Confidence label persisted on the scenario run. */
  confidence: string | null;
}

interface ScenarioOutputShape {
  apy_range?: { low?: number; high?: number };
  risk_score?: number;
  mode?: string;
}

function safeParse<T>(raw: string | null | undefined): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Load the latest ProjectionStudyRun + its first ScenarioRun headline. Returns
 * null when there is no run yet OR on any failure (caller shows demo fixture).
 */
export async function getLatestProjectionStudyRun(): Promise<LatestStudyRunSummary | null> {
  try {
    const study = await prisma.projectionStudyRun.findFirst({
      orderBy: { ranAt: "desc" },
      select: {
        id: true,
        ranAt: true,
        label: true,
        methodologyVersion: true,
        scenarioRunIds: true,
      },
    });
    if (!study) return null;

    const runIds = safeParse<string[]>(study.scenarioRunIds) ?? [];
    let apyRange: LatestStudyRunSummary["apyRange"] = null;
    let riskScore: number | null = null;
    let mode: string | null = null;
    let confidence: string | null = null;

    const firstId = runIds[0];
    if (firstId) {
      const run = await prisma.scenarioRun.findUnique({
        where: { id: firstId },
        select: { outputs: true, confidence: true },
      });
      if (run) {
        confidence = run.confidence ?? null;
        const out = safeParse<ScenarioOutputShape>(run.outputs);
        if (out) {
          if (
            typeof out.apy_range?.low === "number" &&
            typeof out.apy_range?.high === "number"
          ) {
            apyRange = { low: out.apy_range.low, high: out.apy_range.high };
          }
          riskScore = typeof out.risk_score === "number" ? out.risk_score : null;
          mode = typeof out.mode === "string" ? out.mode : null;
        }
      }
    }

    return {
      id: study.id,
      shortId: study.id.slice(0, 8),
      ranAt: study.ranAt.toISOString(),
      label: study.label,
      methodologyVersion: study.methodologyVersion,
      scenarioRunCount: runIds.length,
      apyRange,
      riskScore,
      mode,
      confidence,
    };
  } catch {
    return null;
  }
}
