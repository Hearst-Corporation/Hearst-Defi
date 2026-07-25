/**
 * Diagnostic suite orchestrator. Pure (no server-only): maps a suite name to its
 * runner and wraps the results in the standard envelope. Server-only deps
 * (suppression probe, registry introspection) are INJECTED by the route via
 * safe-dry-run.ts; absent them, the relevant checks report SKIPPED.
 */
import { type DiagnosticSuiteResult, makeSuiteResult } from "./types";
import { runChatRouterDiagnostics } from "./chat-router-diagnostics";
import {
  runOutreachDiagnostics,
  type OutreachDiagnosticsDeps,
} from "./outreach-diagnostics";
import {
  runVaultHitlDiagnostics,
  type VaultHitlDiagnosticsDeps,
} from "./vault-hitl-diagnostics";
import { runGuardDiagnostics } from "./guard-diagnostics";
import {
  runPersistenceDiagnostics,
  type PersistenceDiagnosticsDeps,
} from "./persistence-diagnostics";

export const DIAGNOSTIC_SUITES = [
  "chat-router",
  "outreach",
  "vault-hitl",
  "guards",
  "persistence",
] as const;
export type SuiteName = (typeof DIAGNOSTIC_SUITES)[number];

export interface SuiteDeps {
  outreach?: OutreachDiagnosticsDeps;
  vaultHitl?: VaultHitlDiagnosticsDeps;
  persistence?: PersistenceDiagnosticsDeps;
}

export const SUITE_META: Record<SuiteName, { label: string; blurb: string }> = {
  "chat-router": {
    label: "Chat Router",
    blurb:
      "Real deterministic router — routing, pre-LLM refusals, negation, LP boundary.",
  },
  outreach: {
    label: "Outreach",
    blurb:
      "Real forbidden-words + autonomy policy guards. No Resend, no Inngest event.",
  },
  "vault-hitl": {
    label: "Vault / HITL",
    blurb:
      "Tool registry + HITL gating. Token TTL / DB-write facts skipped honestly.",
  },
  guards: {
    label: "Guards",
    blurb: "Danger-first refusals + output guard + body-size guard.",
  },
  persistence: {
    label: "Persistence",
    blurb:
      "Proves the rollback seam — this probe writes one row inside a transaction that is ALWAYS rolled back: zero net persistence.",
  },
};

export async function runSuite(
  name: SuiteName,
  deps: SuiteDeps = {},
): Promise<DiagnosticSuiteResult> {
  switch (name) {
    case "chat-router":
      return makeSuiteResult(name, runChatRouterDiagnostics());
    case "outreach":
      return makeSuiteResult(name, runOutreachDiagnostics(deps.outreach));
    case "vault-hitl":
      return makeSuiteResult(name, runVaultHitlDiagnostics(deps.vaultHitl));
    case "guards":
      return makeSuiteResult(name, await runGuardDiagnostics());
    case "persistence":
      return makeSuiteResult(
        name,
        runPersistenceDiagnostics(deps.persistence),
        deps.persistence?.rollbackProbe?.executed ? "rolled-back" : "none",
      );
  }
}

export async function runAllSuites(
  deps: SuiteDeps = {},
): Promise<DiagnosticSuiteResult[]> {
  return Promise.all(DIAGNOSTIC_SUITES.map((s) => runSuite(s, deps)));
}
