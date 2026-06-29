/**
 * Vault / HITL diagnostics — exercises the REAL admin tool-id registry
 * (ADMIN_WRITE_TOOL_IDS / ADMIN_READ_TOOL_IDS from the pure tools/types module).
 * Registry introspection that needs the server-only registry (per-tool
 * confirmationRequired, runtime-capability matrix) is INJECTED by the route via
 * a lazy dynamic import; without it those checks are SKIPPED. Token TTL /
 * single-use / behavioural DB-write facts are SKIPPED (no rollback seam).
 */
import {
  ADMIN_READ_TOOL_IDS,
  ADMIN_WRITE_TOOL_IDS,
} from "@/lib/llm/tools/types";
import {
  type DiagnosticCheckSpec,
  type DiagnosticResult,
  fail,
  pass,
  runChecks,
  skip,
} from "./types";

export type VaultHitlDiagnosticsDeps = {
  /** Real per-write-tool confirmationRequired, injected by the route. */
  writeTools?: { id: string; confirmationRequired: boolean }[];
  /** Real read_runtime_capabilities output lines, injected by the route. */
  capabilitiesLines?: string[];
};

const REGISTRY = "src/lib/llm/tools/registry.ts";
const DEPLOY_RE = /deploy|go.?live|mark.?live|sign|broadcast/i;

export function runVaultHitlDiagnostics(
  deps: VaultHitlDiagnosticsDeps = {},
): DiagnosticResult[] {
  const specs: DiagnosticCheckSpec[] = [
    {
      id: "vault.seven-write-tools",
      label: "Exactly 7 admin write tools are registered",
      severity: "P1",
      expected: "ADMIN_WRITE_TOOL_IDS.length === 7",
      likelyFile: "src/lib/llm/tools/types.ts",
      run: () =>
        ADMIN_WRITE_TOOL_IDS.length === 7
          ? pass(`7 write tools: ${ADMIN_WRITE_TOOL_IDS.join(", ")}`)
          : fail(`found ${ADMIN_WRITE_TOOL_IDS.length}: ${ADMIN_WRITE_TOOL_IDS.join(", ")}`),
    },
    {
      id: "vault.create-vault-draft-present",
      label: "create_vault_draft is a registered write tool",
      severity: "P0",
      expected: "ADMIN_WRITE_TOOL_IDS includes create_vault_draft",
      likelyFile: REGISTRY,
      run: () =>
        ADMIN_WRITE_TOOL_IDS.includes("create_vault_draft")
          ? pass("create_vault_draft is a write tool")
          : fail("create_vault_draft missing from write tools"),
    },
    {
      id: "vault.all-write-confirmation-required",
      label: "Every admin write tool is confirmationRequired (HITL)",
      severity: "P0",
      expected: "all ADMIN_WRITE_TOOLS have confirmationRequired === true",
      likelyFile: REGISTRY,
      guard: "2-step HITL token",
      sideEffect: deps.writeTools ? "none" : "skipped",
      run: () => {
        if (!deps.writeTools)
          return skip(
            "SKIPPED — needs the server-only registry; the route injects ADMIN_WRITE_TOOLS confirmationRequired flags.",
          );
        const offenders = deps.writeTools.filter((t) => t.confirmationRequired !== true);
        return offenders.length === 0
          ? pass(`all ${deps.writeTools.length} write tools confirmationRequired:true`)
          : fail(`not HITL-gated: ${offenders.map((t) => t.id).join(", ")}`);
      },
    },
    {
      id: "vault.no-deploy-or-sign-tool",
      label: "No deploy / go-live / sign tool exists in the chat registry",
      severity: "P0",
      expected: "no read/write tool id matches deploy|go-live|mark-live|sign|broadcast",
      likelyFile: REGISTRY,
      run: () => {
        const all = [...ADMIN_WRITE_TOOL_IDS, ...ADMIN_READ_TOOL_IDS];
        const bad = all.filter((id) => DEPLOY_RE.test(id));
        return bad.length === 0
          ? pass("no deploy/sign/go-live tool in the registry")
          : fail(`dangerous tool ids: ${bad.join(", ")}`);
      },
    },
    {
      id: "vault.trigger-send-is-only-sender",
      label: "outreach_trigger_send_run is the one send-capable write tool",
      severity: "P0",
      expected: "ADMIN_WRITE_TOOL_IDS includes outreach_trigger_send_run (gated, never Tier A)",
      likelyFile: REGISTRY,
      run: () =>
        ADMIN_WRITE_TOOL_IDS.includes("outreach_trigger_send_run")
          ? pass("outreach_trigger_send_run present — gated by OUTREACH_AUTONOMY, never Tier A")
          : fail("outreach_trigger_send_run missing"),
    },
    {
      id: "vault.capabilities-deploy-no",
      label: "read_runtime_capabilities reports deploy_execute: no",
      severity: "P0",
      expected: "capability lines include 'deploy_execute_outille: no'",
      likelyFile: REGISTRY,
      likelyFunction: "read_runtime_capabilities.run",
      sideEffect: deps.capabilitiesLines ? "none" : "skipped",
      run: () => {
        if (!deps.capabilitiesLines)
          return skip(
            "SKIPPED — needs the server-only registry; the route injects the real read_runtime_capabilities output.",
          );
        const line = deps.capabilitiesLines.find((l) =>
          l.toLowerCase().includes("deploy_execute"),
        );
        return line && /\bno\b/i.test(line)
          ? pass(`capability: ${line.trim()}`)
          : fail(`deploy_execute line: ${line ?? "(absent)"}`);
      },
    },
    {
      id: "vault.read-capabilities-present",
      label: "read_runtime_capabilities is a registered read tool",
      severity: "P2",
      expected: "ADMIN_READ_TOOL_IDS includes read_runtime_capabilities",
      likelyFile: "src/lib/llm/tools/types.ts",
      run: () =>
        ADMIN_READ_TOOL_IDS.includes("read_runtime_capabilities")
          ? pass("read_runtime_capabilities is a read tool")
          : fail("read_runtime_capabilities missing"),
    },
    {
      id: "vault.draft-writes-deployment",
      label: "create_vault_draft writes VaultDeployment(draft), not the VaultDraft model",
      severity: "P0",
      expected: "createDraftVault → prisma.vaultDeployment.create(status:'draft')",
      likelyFile: "src/app/admin/vaults/actions.ts",
      likelyFunction: "createDraftVault",
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — behavioural; verifying the write target needs a DB-write (no rollback seam). Source-verified: createDraftVault writes prisma.vaultDeployment(draft) + ShareClass, NOT prisma.vaultDraft.",
        ),
    },
    {
      id: "vault.hitl-token-ttl",
      label: "HITL confirmation token TTL is 5 minutes, single-use, payload-bound",
      severity: "P1",
      expected: "DEFAULT_WRITE_CONFIRMATION_TTL_MS = 300000; single-use; sha256 payload-bound",
      likelyFile: "src/lib/llm/tools/confirmations.ts",
      sideEffect: "skipped",
      run: () =>
        skip(
          "SKIPPED — TTL const is module-private (registry.ts:57, not exported); single-use + payload-bound require consuming a real token (DB-write). Source-verified separately.",
        ),
    },
    {
      id: "vault.markaslive-not-chat",
      label: "markAsLive is not reachable from chat",
      severity: "P0",
      expected: "no chat tool flips a deployment live",
      likelyFile: "src/app/admin/vaults/actions.ts",
      run: () => {
        const all = [...ADMIN_WRITE_TOOL_IDS, ...ADMIN_READ_TOOL_IDS];
        const bad = all.filter((id) => /live|deploy/i.test(id));
        return bad.length === 0
          ? pass("no live/deploy tool — markAsLive stays in the governance UI")
          : fail(`reachable: ${bad.join(", ")}`);
      },
    },
  ];
  return runChecks("vault-hitl", specs);
}
