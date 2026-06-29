/**
 * Admin Live Diagnostic Center — shared result types + pure builders.
 *
 * Pure module: no I/O, no DB, no server-only imports. Every diagnostic suite
 * returns DiagnosticResult[] built here. The runtime IS exercised (the suites
 * call the real router/guard/policy functions), but nothing here writes,
 * sends, or persists.
 */

export type DiagnosticStatus = "pass" | "fail" | "warn" | "skipped";
export type DiagnosticSeverity = "P0" | "P1" | "P2" | "INFO";
export type DiagnosticSideEffect =
  | "none"
  | "rolled-back"
  | "mocked"
  | "skipped";
export type DbWrites = "none" | "rolled-back" | "test-only";

export type DiagnosticResult = {
  id: string;
  suite: string;
  label: string;
  status: DiagnosticStatus;
  severity: DiagnosticSeverity;
  expected: string;
  actual: string;
  likelyFile?: string;
  likelyFunction?: string;
  guard?: string;
  sideEffect?: DiagnosticSideEffect;
  evidence?: unknown;
  fixHint?: string;
};

export type DiagnosticSummary = {
  total: number;
  pass: number;
  fail: number;
  warn: number;
  skipped: number;
};

export type DiagnosticSuiteResult = {
  ok: boolean;
  suite: string;
  mode: "dry-run";
  runtimeTouched: true;
  externalSideEffects: false;
  dbWrites: DbWrites;
  results: DiagnosticResult[];
  summary: DiagnosticSummary;
};

/** Outcome of a single check's `run()` — status + a human "actual" line. */
export type CheckOutcome = {
  status: DiagnosticStatus;
  actual: string;
  evidence?: unknown;
};

/** A declarative check spec. `run()` exercises the real runtime and reports. */
export type DiagnosticCheckSpec = {
  id: string;
  label: string;
  severity: DiagnosticSeverity;
  expected: string;
  likelyFile?: string;
  likelyFunction?: string;
  guard?: string;
  sideEffect?: DiagnosticSideEffect;
  fixHint?: string;
  run: () => CheckOutcome;
};

// ── outcome helpers ────────────────────────────────────────────────
export const pass = (actual: string, evidence?: unknown): CheckOutcome => ({
  status: "pass",
  actual,
  evidence,
});
export const fail = (actual: string, evidence?: unknown): CheckOutcome => ({
  status: "fail",
  actual,
  evidence,
});
export const warn = (actual: string, evidence?: unknown): CheckOutcome => ({
  status: "warn",
  actual,
  evidence,
});
export const skip = (actual: string): CheckOutcome => ({
  status: "skipped",
  actual,
});

/**
 * Run a list of check specs into DiagnosticResult[]. A thrown check is recorded
 * as a FAIL (never a silent pass) so a broken seam surfaces honestly.
 */
export function runChecks(
  suite: string,
  specs: readonly DiagnosticCheckSpec[],
): DiagnosticResult[] {
  return specs.map((s) => {
    let outcome: CheckOutcome;
    try {
      outcome = s.run();
    } catch (err) {
      outcome = {
        status: "fail",
        actual: `check threw: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
    return {
      id: s.id,
      suite,
      label: s.label,
      status: outcome.status,
      severity: s.severity,
      expected: s.expected,
      actual: outcome.actual,
      likelyFile: s.likelyFile,
      likelyFunction: s.likelyFunction,
      guard: s.guard,
      sideEffect: s.sideEffect ?? "none",
      evidence: outcome.evidence,
      fixHint: s.fixHint,
    };
  });
}

export function summarize(results: readonly DiagnosticResult[]): DiagnosticSummary {
  const summary: DiagnosticSummary = {
    total: results.length,
    pass: 0,
    fail: 0,
    warn: 0,
    skipped: 0,
  };
  for (const r of results) summary[r.status] += 1;
  return summary;
}

/** Assemble the suite envelope. `ok` is true when there are zero FAILs. */
export function makeSuiteResult(
  suite: string,
  results: DiagnosticResult[],
  dbWrites: DbWrites = "none",
): DiagnosticSuiteResult {
  const summary = summarize(results);
  return {
    ok: summary.fail === 0,
    suite,
    mode: "dry-run",
    runtimeTouched: true,
    externalSideEffects: false,
    dbWrites,
    results,
    summary,
  };
}
