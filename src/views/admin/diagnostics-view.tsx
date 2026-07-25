import { DynavaultChainPanel } from "@/components/admin/chain/dynavault-chain-panel";
import { DynavaultOpsReadout } from "@/components/admin/chain/dynavault-ops-readout";
import { ChatActionLab } from "@/components/admin/diagnostics/chat-action-lab";
import { DiagnosticCenter } from "@/components/admin/diagnostics/diagnostic-center";
import { DiagnosticFlowTheater } from "@/components/admin/diagnostics/diagnostic-flow-theater";
import { DiagnosticResultTable } from "@/components/admin/diagnostics/diagnostic-result-table";
import { OutreachLifecycleDemo } from "@/components/admin/diagnostics/outreach-lifecycle-demo";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { runBtcMiningVaultDiagnostics } from "@/lib/admin/diagnostics/btc-mining-vault-diagnostics";
import { runBtcProductConstructionDiagnostics } from "@/lib/admin/diagnostics/btc-product-construction-diagnostics";
import { runBtcMiningConstructionScenarioDiagnostics } from "@/lib/admin/diagnostics/btc-mining-construction-scenario-diagnostics";
import { runChatActionLab } from "@/lib/admin/diagnostics/chat-action-lab";
import { buildOutreachLifecycleDemo } from "@/lib/admin/diagnostics/outreach-lifecycle";
import {
  DIAGNOSTIC_SUITES,
  SUITE_META,
  runAllSuites,
} from "@/lib/admin/diagnostics/run-diagnostic-suite";
import {
  buildOutreachDeps,
  buildVaultHitlDeps,
} from "@/lib/admin/diagnostics/safe-dry-run";
import type { DiagnosticSuiteResult } from "@/lib/admin/diagnostics/types";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

export async function AdminDiagnosticsView() {
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

  const chatActionReport = runChatActionLab();
  const lifecycleReport = buildOutreachLifecycleDemo();
  const btcMiningVaultResults = runBtcMiningVaultDiagnostics();
  const btcProductConstructionResults = runBtcProductConstructionDiagnostics();
  const btcMiningScenarioResults = runBtcMiningConstructionScenarioDiagnostics();

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Admin product QA · dry-run"
        title="Diagnostics"
        description="Scripted walkthroughs and live probes — each section states which it is. Probes are read-only: no writes, no email, no deploys (one exception: the Persistence suite states its own rollback write)."
      />

      <Section
        title="Vault contract wiring"
        description="Which vault contract the app is pointed at and what it returns right now."
      >
        <Panel>
          <DynavaultChainPanel />
        </Panel>
      </Section>

      <Section
        title="Vault operations (v2)"
        description="Operational surface of PermissionedDynaVault v2.1."
      >
        <Panel>
          <DynavaultOpsReadout />
        </Panel>
      </Section>

      <Section title="Overview">
        <Panel>
          <ol className="list-decimal space-y-2 p-5 pl-8 text-xs leading-relaxed text-[var(--ct-text-muted)]">
            <li>Flow Theater — scripted walkthrough of prompt travel through router → gates → action.</li>
            <li>Chat Action Lab — critical prompts via deterministic router.</li>
            <li>Outreach Lifecycle Demo — every send path, dry-run.</li>
            <li>Technical Suites — Chat/Projection/Outreach/Vault/Guards probes.</li>
          </ol>
        </Panel>
      </Section>

      <Section
        title="Flow theater — scripted walkthrough"
        description="Pre-written scenarios animating the guard pipeline. Only “Run live” calls the real diagnostic APIs."
      >
        <Panel>
          <div className={FORM_SURFACE}>
            <DiagnosticFlowTheater />
          </div>
        </Panel>
      </Section>

      <Section title="Chat action lab">
        <Panel>
          <div className={FORM_SURFACE}>
            <ChatActionLab initial={chatActionReport} />
          </div>
        </Panel>
      </Section>

      <Section title="Outreach lifecycle demo">
        <Panel>
          <div className={FORM_SURFACE}>
            <OutreachLifecycleDemo report={lifecycleReport} />
          </div>
        </Panel>
      </Section>

      <Section title="Technical suites">
        <Panel>
          <div className={FORM_SURFACE}>
            <DiagnosticCenter suites={suites} initial={initial} />
          </div>
        </Panel>
      </Section>

      <Section title="BTC Mining Performance Vault — product diagnostics">
        <Panel>
          <div className={FORM_SURFACE}>
            <DiagnosticResultTable results={btcMiningVaultResults} />
          </div>
        </Panel>
      </Section>

      <Section title="BTC product construction — orchestration diagnostics">
        <Panel>
          <div className={FORM_SURFACE}>
            <DiagnosticResultTable results={btcProductConstructionResults} />
          </div>
        </Panel>
      </Section>

      <Section title="BTC mining construction — scenario diagnostics">
        <Panel>
          <div className={FORM_SURFACE}>
            <DiagnosticResultTable results={btcMiningScenarioResults} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
