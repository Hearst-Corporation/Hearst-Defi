// Agentic Simulation Aggregates — PURE, metadata-only aggregation.
//
// Aggregates already-recorded `AgenticSimulationTrace` values (counts + machine
// codes only). It NEVER reads or emits a prompt, user message, raw payload,
// context, token, header, secret, or stack trace — it copies no free-text field
// from the trace. No I/O, no Date read (the window cutoff is injected), so the
// output is deterministic given the same input.

import type {
  AgenticSimulationTrace,
  SimulationSwarmMode,
} from "./simulation-trace";

export type SimulationWindowKey = "1h" | "24h" | "7d" | "all";

const WINDOW_MS: Record<Exclude<SimulationWindowKey, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export type SimulationAggregateOptions = {
  /** Window to filter by `createdAt`. Default "all" (no filtering). */
  window?: SimulationWindowKey;
  /** Injected "now" in ms for window filtering (keeps this function pure). */
  nowMs?: number;
  /** Max distinct reason codes to surface. Default 10. */
  topReasonCodesLimit?: number;
};

export type SimulationAggregates = {
  window: {
    requested: SimulationWindowKey;
    from?: string;
    to?: string;
    traceCount: number;
  };
  totals: {
    simulations: number;
    blocked: number;
    gates: number;
    confirmations: number;
    recordedWithReadiness: number;
  };
  bySwarm: Array<{
    swarmId: string;
    count: number;
    blockedCount: number;
    gateCount: number;
    confirmationCount: number;
  }>;
  byMode: Array<{ mode: SimulationSwarmMode; count: number }>;
  byReadinessOutcome: Array<{ outcome: string; count: number }>;
  topReasonCodes: Array<{ reasonCode: string; count: number }>;
  metadataOnly: true;
};

/** Parse a raw window query param into a known key, or undefined if invalid. */
export function parseSimulationWindow(
  raw: string | null | undefined,
): SimulationWindowKey | undefined {
  if (raw === null || raw === undefined || raw === "") return "all";
  if (raw === "1h" || raw === "24h" || raw === "7d" || raw === "all") return raw;
  return undefined;
}

/** Stable sort: count desc, then key asc. Deterministic. */
function sortByCountThenKey<T extends { count: number }>(
  rows: T[],
  keyOf: (row: T) => string,
): T[] {
  return [...rows].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return keyOf(a).localeCompare(keyOf(b));
  });
}

/**
 * Aggregate metadata-only simulation traces. Pure & deterministic. Applies an
 * optional time window (using the injected `nowMs`), then rolls up totals and
 * group-by tallies. Emits no raw trace body and no free text.
 */
export function aggregateAgenticSimulationTraces(
  traces: AgenticSimulationTrace[],
  options: SimulationAggregateOptions = {},
): SimulationAggregates {
  const requested: SimulationWindowKey = options.window ?? "all";
  const topLimit = Math.max(1, options.topReasonCodesLimit ?? 10);

  // Window filter (best-effort: a trace with an unparseable createdAt is kept
  // only when no window is applied, so a bad timestamp never inflates a window).
  let from: string | undefined;
  let to: string | undefined;
  let windowed: AgenticSimulationTrace[] = traces;
  if (requested !== "all" && typeof options.nowMs === "number") {
    const cutoff = options.nowMs - WINDOW_MS[requested];
    from = new Date(cutoff).toISOString();
    to = new Date(options.nowMs).toISOString();
    windowed = traces.filter((t) => {
      const ms = Date.parse(t.createdAt);
      return Number.isFinite(ms) && ms >= cutoff && ms <= options.nowMs!;
    });
  }

  const totals = {
    simulations: windowed.length,
    blocked: 0,
    gates: 0,
    confirmations: 0,
    recordedWithReadiness: 0,
  };

  const swarmMap = new Map<
    string,
    { count: number; blockedCount: number; gateCount: number; confirmationCount: number }
  >();
  const modeMap = new Map<SimulationSwarmMode, number>();
  const readinessMap = new Map<string, number>();
  const reasonMap = new Map<string, number>();

  for (const t of windowed) {
    // Defensive: only read the allowlisted numeric/id/code fields.
    const blocked = Number.isFinite(t.blockedCount) ? t.blockedCount : 0;
    const gates = Number.isFinite(t.gateCount) ? t.gateCount : 0;
    const confirmations = Number.isFinite(t.confirmationCount)
      ? t.confirmationCount
      : 0;

    totals.blocked += blocked;
    totals.gates += gates;
    totals.confirmations += confirmations;
    if (t.readinessOutcome) totals.recordedWithReadiness += 1;

    const sw = swarmMap.get(t.swarmId) ?? {
      count: 0,
      blockedCount: 0,
      gateCount: 0,
      confirmationCount: 0,
    };
    sw.count += 1;
    sw.blockedCount += blocked;
    sw.gateCount += gates;
    sw.confirmationCount += confirmations;
    swarmMap.set(t.swarmId, sw);

    modeMap.set(t.swarmMode, (modeMap.get(t.swarmMode) ?? 0) + 1);

    if (t.readinessOutcome) {
      readinessMap.set(
        t.readinessOutcome,
        (readinessMap.get(t.readinessOutcome) ?? 0) + 1,
      );
    }

    for (const code of Array.isArray(t.auditReasonCodes)
      ? t.auditReasonCodes
      : []) {
      if (typeof code === "string") {
        reasonMap.set(code, (reasonMap.get(code) ?? 0) + 1);
      }
    }
  }

  const bySwarm = sortByCountThenKey(
    [...swarmMap.entries()].map(([swarmId, v]) => ({ swarmId, ...v })),
    (r) => r.swarmId,
  );
  const byMode = sortByCountThenKey(
    [...modeMap.entries()].map(([mode, count]) => ({ mode, count })),
    (r) => r.mode,
  );
  const byReadinessOutcome = sortByCountThenKey(
    [...readinessMap.entries()].map(([outcome, count]) => ({ outcome, count })),
    (r) => r.outcome,
  );
  const topReasonCodes = sortByCountThenKey(
    [...reasonMap.entries()].map(([reasonCode, count]) => ({ reasonCode, count })),
    (r) => r.reasonCode,
  ).slice(0, topLimit);

  return {
    window: {
      requested,
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
      traceCount: windowed.length,
    },
    totals,
    bySwarm,
    byMode,
    byReadinessOutcome,
    topReasonCodes,
    metadataOnly: true,
  };
}
