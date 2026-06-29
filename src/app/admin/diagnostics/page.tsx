// Admin · Live Diagnostic Center — real dry-run health probes plus an admin
// product-QA layer: a Live Flow Theater (watch a prompt travel the chat), a
// Chat Action Lab (what the chat does with critical prompts), an Outreach
// Lifecycle Demo (every send path, dry-run), and the underlying technical
// suites. Server Component; gated by the /admin layout (session.role ===
// "admin"). Read-only: exercises real runtime functions + read-only probes;
// never writes, sends, or deploys.

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { DiagnosticCenter } from "@/components/admin/diagnostics/diagnostic-center";
import { DiagnosticFlowTheater } from "@/components/admin/diagnostics/diagnostic-flow-theater";
import { ChatActionLab } from "@/components/admin/diagnostics/chat-action-lab";
import { OutreachLifecycleDemo } from "@/components/admin/diagnostics/outreach-lifecycle-demo";
import { DiagnosticResultTable } from "@/components/admin/diagnostics/diagnostic-result-table";
import type { DiagnosticSuiteResult } from "@/lib/admin/diagnostics/types";
import { runBtcMiningVaultDiagnostics } from "@/lib/admin/diagnostics/btc-mining-vault-diagnostics";
import { runBtcProductConstructionDiagnostics } from "@/lib/admin/diagnostics/btc-product-construction-diagnostics";
import { runBtcMiningConstructionScenarioDiagnostics } from "@/lib/admin/diagnostics/btc-mining-construction-scenario-diagnostics";
import {
  DIAGNOSTIC_SUITES,
  SUITE_META,
  runAllSuites,
} from "@/lib/admin/diagnostics/run-diagnostic-suite";
import {
  buildOutreachDeps,
  buildVaultHitlDeps,
} from "@/lib/admin/diagnostics/safe-dry-run";
import { runChatActionLab } from "@/lib/admin/diagnostics/chat-action-lab";
import { buildOutreachLifecycleDemo } from "@/lib/admin/diagnostics/outreach-lifecycle";

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

  // Pure, read-only — no LLM, no send, no write, no persistence.
  const chatActionReport = runChatActionLab();
  const lifecycleReport = buildOutreachLifecycleDemo();
  // Pure product diagnostics — exercises the real BTC Mining Vault product /
  // guards / engine functions, dry-run, no writes/sends.
  const btcMiningVaultResults = runBtcMiningVaultDiagnostics();
  const btcProductConstructionResults = runBtcProductConstructionDiagnostics();
  const btcMiningScenarioResults = runBtcMiningConstructionScenarioDiagnostics();

  return (
    <AdminPageShell
      titleLead="Live"
      titleAccent="Diagnostics"
      contextLabel="admin product QA · dry-run · no writes, no email"
    >
      {/* 1 — Overview */}
      <AdminSectionCard
        title="Overview"
        subtitle="A product-QA console, not just a technical table. Watch a prompt travel the chat, test what the cockpit chat does with critical prompts, walk the outreach send lifecycle, and run the underlying technical suites — all dry-run. Nothing here sends email, deploys, or persists a business record."
        ariaLabel="Overview"
      >
        <ol className="flex flex-col gap-1 p-5 text-xs text-[var(--ct-text-secondary)]">
          <li>
            <span className="text-[var(--ct-accent)]">1.</span> Live Flow Theater —
            watch a prompt travel the chat: router → gates → action, refusal or HITL.
          </li>
          <li>
            <span className="text-[var(--ct-accent)]">2.</span> Chat Action Lab —
            prompt → routing → page/action → writes/send/HITL → verdict.
          </li>
          <li>
            <span className="text-[var(--ct-accent)]">3.</span> Outreach Lifecycle
            Demo — every send path, dry-run, with its guard sequence.
          </li>
          <li>
            <span className="text-[var(--ct-accent)]">4.</span> Technical Suites —
            the underlying Chat/Projection/Outreach/Vault/Guards probes.
          </li>
        </ol>
      </AdminSectionCard>

      {/* 2 — Live Flow Theater */}
      <AdminSectionCard
        title="Live flow theater"
        subtitle="Watch a prompt travel the chat — router → gates → action, refusal or HITL — then press “Run live” to fire the real suite endpoint and see the actual result."
        ariaLabel="Live flow theater"
      >
        <div className="p-5">
          <DiagnosticFlowTheater />
        </div>
      </AdminSectionCard>

      {/* 3 — Chat Action Lab */}
      <AdminSectionCard
        title="Chat Action Lab"
        subtitle="What the cockpit chat would do with critical prompts — exercised through the REAL deterministic router. No LLM call, no POST to the chat, no message/run persistence, no action."
        ariaLabel="Chat Action Lab"
      >
        <div className="p-5">
          <ChatActionLab initial={chatActionReport} />
        </div>
      </AdminSectionCard>

      {/* 4 — Outreach Lifecycle Demo */}
      <AdminSectionCard
        title="Outreach Lifecycle Demo"
        subtitle="A readable dry-run walk of every outreach send path — draft, direct send, campaign fan-out, auto-send, follow-ups, suppression, forbidden words. Safety verdicts are derived from the real policy functions. No Resend, no Inngest, no email."
        ariaLabel="Outreach Lifecycle Demo"
      >
        <div className="p-5">
          <OutreachLifecycleDemo report={lifecycleReport} />
        </div>
      </AdminSectionCard>

      {/* 5 — Technical Suites */}
      <AdminSectionCard
        title="Technical Suites"
        subtitle="Real dry-run checks for Chat, Projection, Outreach, Vault/HITL and Guards. The low-level invariants behind the labs above."
        ariaLabel="Technical Suites"
      >
        <div className="p-5">
          <DiagnosticCenter suites={suites} initial={initial} />
        </div>
      </AdminSectionCard>

      {/* 6 — BTC Mining Performance Vault product diagnostics */}
      <AdminSectionCard
        title="BTC Mining Performance Vault — product diagnostics"
        subtitle="Dry-run checks exercising the REAL product / guards / engine functions: no guaranteed-APY language, no double counting, mining floor enforced, configured-not-validated, coverage gate, recovery not a guarantee, BTC sale last-resort, reserve not spent first. No writes, no sends."
        ariaLabel="BTC Mining Performance Vault product diagnostics"
      >
        <div className="p-5">
          <DiagnosticResultTable results={btcMiningVaultResults} />
        </div>
      </AdminSectionCard>

      {/* 7 — BTC Product Construction Orchestration diagnostics */}
      <AdminSectionCard
        title="BTC product construction — orchestration diagnostics"
        subtitle="Dry-run checks for the parallel-swarm / sequenced-reveal contract: deterministic render order, dependency gates, ONE canonical allocation read by summary/scenarios/write-up/wizard, 30% mining floor (raw sub-floor rejected), scenario percent format, targets never summed, product name, no guarantee language, no writes/sends/deploys."
        ariaLabel="BTC product construction orchestration diagnostics"
      >
        <div className="p-5">
          <DiagnosticResultTable results={btcProductConstructionResults} />
        </div>
      </AdminSectionCard>

      {/* 8 — BTC Mining Construction Scenario diagnostics (canvas model) */}
      <AdminSectionCard
        title="BTC mining construction — scenario diagnostics"
        subtitle="Replays construction → 3 scenarios → steps via the tested canvas model (docs/strategy/btc-mining-vault-calculation-canvas.html): scenarios present, 30% mining floor, allocator-adjusted APY never silently negative, coverage classified, steps carry formulas, export well-formed, CONFIGURED never VALIDATED. Documents the chat-tool scenario gap. No writes/sends/deploys."
        ariaLabel="BTC mining construction scenario diagnostics"
      >
        <div className="p-5">
          <DiagnosticResultTable results={btcMiningScenarioResults} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
