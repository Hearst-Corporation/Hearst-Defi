// Admin · Live Diagnostic Center — real dry-run health probes plus an admin
// product-QA layer: a Chat Action Lab (what the chat does with critical
// prompts), an Outreach Lifecycle Demo (every send path, dry-run), and the
// existing technical suites. Server Component; gated by the /admin layout
// (session.role === "admin"). Read-only: exercises real runtime functions +
// read-only probes; never writes, sends, or deploys.

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { DiagnosticCenter } from "@/components/admin/diagnostics/diagnostic-center";
import { ChatActionLab } from "@/components/admin/diagnostics/chat-action-lab";
import { OutreachLifecycleDemo } from "@/components/admin/diagnostics/outreach-lifecycle-demo";
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

  return (
    <AdminPageShell
      titleLead="Live"
      titleAccent="Diagnostics"
      contextLabel="admin product QA · dry-run · no writes, no email"
    >
      {/* 1 — Overview */}
      <AdminSectionCard
        title="Overview"
        subtitle="A product-QA console, not just a technical table. Test what the cockpit chat does with critical prompts, walk the outreach send lifecycle, and run the underlying technical suites — all dry-run. Nothing here sends email, deploys, or persists a business record."
        ariaLabel="Overview"
      >
        <ol className="flex flex-col gap-1 p-5 text-xs text-[var(--ct-text-secondary)]">
          <li>
            <span className="text-[var(--ct-accent)]">1.</span> Chat Action Lab —
            prompt → routing → page/action → writes/send/HITL → verdict.
          </li>
          <li>
            <span className="text-[var(--ct-accent)]">2.</span> Outreach Lifecycle
            Demo — every send path, dry-run, with its guard sequence.
          </li>
          <li>
            <span className="text-[var(--ct-accent)]">3.</span> Technical Suites —
            the underlying Chat/Projection/Outreach/Vault/Guards probes.
          </li>
        </ol>
      </AdminSectionCard>

      {/* 2 — Chat Action Lab */}
      <AdminSectionCard
        title="Chat Action Lab"
        subtitle="What the cockpit chat would do with critical prompts — exercised through the REAL deterministic router. No LLM call, no POST to the chat, no message/run persistence, no action."
        ariaLabel="Chat Action Lab"
      >
        <div className="p-5">
          <ChatActionLab initial={chatActionReport} />
        </div>
      </AdminSectionCard>

      {/* 3 — Outreach Lifecycle Demo */}
      <AdminSectionCard
        title="Outreach Lifecycle Demo"
        subtitle="A readable dry-run walk of every outreach send path — draft, direct send, campaign fan-out, auto-send, follow-ups, suppression, forbidden words. Safety verdicts are derived from the real policy functions. No Resend, no Inngest, no email."
        ariaLabel="Outreach Lifecycle Demo"
      >
        <div className="p-5">
          <OutreachLifecycleDemo report={lifecycleReport} />
        </div>
      </AdminSectionCard>

      {/* 4 — Technical Suites */}
      <AdminSectionCard
        title="Technical Suites"
        subtitle="Real dry-run checks for Chat, Projection, Outreach, Vault/HITL and Guards. The low-level invariants behind the labs above."
        ariaLabel="Technical Suites"
      >
        <div className="p-5">
          <DiagnosticCenter suites={suites} initial={initial} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
