// Admin · Live Diagnostic Center — real dry-run health probes for Chat, Projection,
// Outreach, Vault/HITL and Guards. Server Component; gated by the /admin layout
// (session.role === "admin"). Read-only: exercises real runtime functions +
// read-only probes; never writes, sends, or deploys.

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { DiagnosticCenter } from "@/components/admin/diagnostics/diagnostic-center";
import { DiagnosticFlowTheater } from "@/components/admin/diagnostics/diagnostic-flow-theater";
import type { DiagnosticSuiteResult } from "@/lib/admin/diagnostics/types";
import {
  DIAGNOSTIC_SUITES,
  SUITE_META,
  runAllSuites,
} from "@/lib/admin/diagnostics/run-diagnostic-suite";
import {
  buildOutreachDeps,
  buildVaultHitlDeps,
} from "@/lib/admin/diagnostics/safe-dry-run";

export const dynamic = "force-dynamic";
export const metadata = { title: "Live Diagnostics — Hearst Connect" };

export default async function AdminDiagnosticsPage() {
  const [outreach, vaultHitl] = await Promise.all([
    buildOutreachDeps(),
    buildVaultHitlDeps(),
  ]);
  const suiteResults = await runAllSuites({ outreach, vaultHitl });

  const initial: Record<string, DiagnosticSuiteResult> = {};
  for (const r of suiteResults) initial[r.suite] = r;

  const suites = DIAGNOSTIC_SUITES.map((name) => ({
    name,
    label: SUITE_META[name].label,
    blurb: SUITE_META[name].blurb,
  }));

  return (
    <AdminPageShell
      titleLead="Live"
      titleAccent="Diagnostics"
      contextLabel="dry-run · real runtime probes · no writes, no email"
    >
      <AdminSectionCard
        title="Live flow theater"
        subtitle="Watch a prompt travel the chat — router → gates → action, refusal or HITL — then press “Run live” to fire the real suite endpoint and see the actual result."
        ariaLabel="Live flow theater"
      >
        <div className="p-5">
          <DiagnosticFlowTheater />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        title="Flow health"
        subtitle="Real dry-run checks for Chat, Projection, Outreach, Vault/HITL, Guards and Persistence. Nothing here sends email, deploys, or persists a business record."
        ariaLabel="Flow health"
      >
        <div className="p-5">
          <DiagnosticCenter suites={suites} initial={initial} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
