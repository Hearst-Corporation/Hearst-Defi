/**
 * Safe dry-run seams — server-only. These are the ONLY places a diagnostic
 * touches a server-only module, and they do so via lazy dynamic import so the
 * pure suite libs (and their unit tests) never pull the heavy graph.
 *
 * Everything here is READ-ONLY:
 *  - buildOutreachDeps  → one isSuppressed() query (prisma findFirst, no write)
 *  - buildVaultHitlDeps → reads the in-memory tool registry + runs the PURE
 *    read_runtime_capabilities tool (object literal, no DB)
 *
 * No write, no email, no Inngest event, no token consumption. If a dynamic
 * import fails, the dep is left undefined and the dependent check reports
 * SKIPPED rather than faking a pass.
 */
import "server-only";

import type { AdminReadToolExecutionContext } from "@/lib/llm/tools/types";
import type { OutreachDiagnosticsDeps } from "./outreach-diagnostics";
import type { VaultHitlDiagnosticsDeps } from "./vault-hitl-diagnostics";

/** A deliberately invalid TLD so the probe can never reach a real inbox. */
const SUPPRESSION_PROBE_EMAIL = "diagnostics-probe@hearst.invalid";

export async function buildOutreachDeps(): Promise<OutreachDiagnosticsDeps> {
  try {
    const { isSuppressed } = await import("@/lib/outreach/suppression");
    const suppressed = await isSuppressed(SUPPRESSION_PROBE_EMAIL);
    return {
      suppressionProbe: { email: SUPPRESSION_PROBE_EMAIL, suppressed },
    };
  } catch {
    return {};
  }
}

export async function buildVaultHitlDeps(): Promise<VaultHitlDiagnosticsDeps> {
  const deps: VaultHitlDiagnosticsDeps = {};
  try {
    const { ADMIN_WRITE_TOOLS, ADMIN_READ_TOOLS } = await import(
      "@/lib/llm/tools/registry"
    );
    deps.writeTools = ADMIN_WRITE_TOOLS.map((t) => ({
      id: t.id,
      confirmationRequired: t.confirmationRequired,
    }));
    const cap = ADMIN_READ_TOOLS.find((t) => t.id === "read_runtime_capabilities");
    if (cap) {
      const ctx = {
        chatMode: "admin",
        profile: "admin",
      } as unknown as AdminReadToolExecutionContext;
      const out = (await cap.run(ctx)) as { lines?: unknown };
      if (out && Array.isArray(out.lines)) {
        deps.capabilitiesLines = out.lines.filter(
          (l): l is string => typeof l === "string",
        );
      }
    }
  } catch {
    // leave deps partial → dependent checks report SKIPPED
  }
  return deps;
}
