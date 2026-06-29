/**
 * Diagnostic suite orchestrator. Pure (no server-only): maps a suite name to its
 * runner and wraps the results in the standard envelope. Server-only deps
 * (suppression probe, registry introspection) are INJECTED by the route via
 * safe-dry-run.ts; absent them, the relevant checks report SKIPPED.
 */
import { type DiagnosticSuiteResult, makeSuiteResult } from "./types";
import { runChatRouterDiagnostics } from "./chat-router-diagnostics";
import { runProjectionDiagnostics } from "./projection-diagnostics";
import {
  runOutreachDiagnostics,
  type OutreachDiagnosticsDeps,
} from "./outreach-diagnostics";
import {
  runVaultHitlDiagnostics,
  type VaultHitlDiagnosticsDeps,
} from "./vault-hitl-diagnostics";
import { runGuardDiagnostics } from "./guard-diagnostics";

export const DIAGNOSTIC_SUITES = [
  "chat-router",
  "projection",
  "outreach",
  "vault-hitl",
  "guards",
] as const;
export type SuiteName = (typeof DIAGNOSTIC_SUITES)[number];

export function isSuiteName(value: unknown): value is SuiteName {
  return (
    typeof value === "string" &&
    (DIAGNOSTIC_SUITES as readonly string[]).includes(value)
  );
}

export interface SuiteDeps {
  outreach?: OutreachDiagnosticsDeps;
  vaultHitl?: VaultHitlDiagnosticsDeps;
}

export const SUITE_META: Record<SuiteName, { label: string; blurb: string }> = {
  "chat-router": {
    label: "Chat Router",
    blurb:
      "Real deterministic router — routing, pre-LLM refusals, negation, LP boundary.",
  },
  projection: {
    label: "Projection",
    blurb:
      "Safe preset (no numeric prefill). Run / promote are DB-writes → skipped honestly.",
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
};

export async function runSuite(
  name: SuiteName,
  deps: SuiteDeps = {},
): Promise<DiagnosticSuiteResult> {
  switch (name) {
    case "chat-router":
      return makeSuiteResult(name, runChatRouterDiagnostics());
    case "projection":
      return makeSuiteResult(name, runProjectionDiagnostics());
    case "outreach":
      return makeSuiteResult(name, runOutreachDiagnostics(deps.outreach));
    case "vault-hitl":
      return makeSuiteResult(name, runVaultHitlDiagnostics(deps.vaultHitl));
    case "guards":
      return makeSuiteResult(name, await runGuardDiagnostics());
  }
}

export async function runAllSuites(
  deps: SuiteDeps = {},
): Promise<DiagnosticSuiteResult[]> {
  return Promise.all(DIAGNOSTIC_SUITES.map((s) => runSuite(s, deps)));
}
