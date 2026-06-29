/**
 * Persistence diagnostics — proves the rollback seam works against the REAL DB
 * (create → assert in-tx → rollback, zero net persistence). The probe is a real
 * DB write that is ALWAYS rolled back; it is injected by the route. Without it,
 * the check is SKIPPED.
 *
 * The real Server Actions (runProjectionStudy / createDraftVault) write via the
 * GLOBAL prisma client and accept no `tx`, so they cannot be wrapped by this
 * seam without a runtime refactor — those stay honestly SKIPPED.
 */
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
  skip,
} from "./types";

export type RollbackProbe = {
  executed: boolean;
  beforeCount: number;
  inTxCount: number;
  afterCount: number;
  rolledBack: boolean;
  persisted: boolean;
  error?: string;
};

export type PersistenceDiagnosticsDeps = {
  /** Real create→rollback probe result, injected by the route (rolled-back write). */
  rollbackProbe?: RollbackProbe;
};

export function runPersistenceDiagnostics(
  deps: PersistenceDiagnosticsDeps = {},
): DiagnosticResult[] {
  const specs: DiagnosticCheckSpec[] = [
    {
      id: "persist.rollback-seam",
      label: "Rollback seam: real create → assert in-tx → rollback, zero persistence",
      severity: "P1",
      expected:
        "row visible in-tx (before+1); after rollback the count is unchanged; rolledBack = true",
      likelyFile: "src/lib/admin/diagnostics/safe-dry-run.ts",
      likelyFunction: "runInRollbackTransaction",
      sideEffect: deps.rollbackProbe?.executed ? "rolled-back" : "skipped",
      run: () => {
        const p = deps.rollbackProbe;
        if (!p || !p.executed)
          return skip(
            "SKIPPED — needs a server DB; the route injects a real create→rollback probe.",
          );
        if (p.error) return fail(`probe error: ${p.error}`, p);
        const inTxOk = p.inTxCount === p.beforeCount + 1;
        const goneAfter = p.afterCount === p.beforeCount && !p.persisted;
        return p.rolledBack && inTxOk && goneAfter
          ? pass(
              `in-tx count ${p.beforeCount}→${p.inTxCount}; after rollback ${p.afterCount} (0 rows persisted)`,
              p,
            )
          : fail(
              `rolledBack=${p.rolledBack}, inTx=${p.inTxCount} (expected ${p.beforeCount + 1}), after=${p.afterCount} (expected ${p.beforeCount}), persisted=${p.persisted}`,
              p,
            );
      },
    },
    {
      id: "persist.actions-not-tx-capable",
      label: "Action-level writes stay skipped (global prisma client, no tx param)",
      severity: "INFO",
      expected:
        "runProjectionStudy / createDraftVault use the global client; a live ACTION rollback needs a runtime refactor (out of scope)",
      likelyFile: "src/app/admin/projection/actions.ts · src/app/admin/vaults/actions.ts",
      sideEffect: "skipped",
      run: () =>
        skip(
          "INFO — the real Server Actions write via the global prisma client and take no tx, so a live create→rollback of the ACTION would require a runtime refactor (intentionally out of scope). The seam above proves rollback works for direct model writes.",
        ),
    },
  ];
  return runChecks("persistence", specs);
}
