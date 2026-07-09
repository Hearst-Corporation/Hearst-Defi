export const dynamic = "force-dynamic";

import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { ModelBenchClient } from "@/components/bench/model-bench-client";
import { RunHistoryPanel } from "@/components/bench/run-history-panel";
import { benchProviderInfos } from "@/lib/bench/providers";
import { loadBenchHistory } from "@/lib/bench/history";
import { env } from "@/lib/env";

/**
 * Model Bench — admin comparison arena.
 *
 * Two panels: (1) a live comparison chat that fans one prompt across the
 * selected models side by side (latency / cost / tokens / compliance per
 * model), and (2) the run history rolled up from the shared LlmRun table.
 *
 * ADR-011: this NEVER changes the product model (gpt-4.1). It is a decision
 * lab — a winning model would move to production via an ADR, not a swap here.
 */
export default async function ModelBenchPage() {
  const providers = benchProviderInfos();
  const history = await loadBenchHistory(40);
  const tracing =
    env.LANGSMITH_TRACING === "true" && Boolean(env.LANGSMITH_API_KEY);
  const availableCount = providers.filter((p) => p.available).length;

  return (
    <AdminPageShell
      titleLead="Model"
      titleAccent="Bench"
      contextLabel="Agent Ops"
    >
      <AdminSectionCard
        ariaLabel="Model comparison arena"
        title="Arène de comparaison"
        subtitle={`Un prompt, ${availableCount} modèle(s) en parallèle. Latence, coût, tokens et conformité par modèle. Lab uniquement — ne change pas le modèle produit (ADR-011).`}
      >
        <div className="p-5">
          <ModelBenchClient providers={providers} tracing={tracing} />
        </div>
      </AdminSectionCard>

      <AdminSectionCard
        ariaLabel="Run history"
        title="Historique des runs"
        subtitle={`${history.totalRuns} appel(s) LLM enregistrés (agents + chat). Rollup par agent + les runs récents. Source : table LlmRun, la même que celle observée dans LangSmith.`}
      >
        <div className="p-5">
          <RunHistoryPanel history={history} />
        </div>
      </AdminSectionCard>
    </AdminPageShell>
  );
}
