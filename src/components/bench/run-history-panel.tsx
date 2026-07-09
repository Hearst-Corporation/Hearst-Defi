import { cn } from "@/lib/cn";
import type { BenchHistory } from "@/lib/bench/history";

/**
 * RunHistoryPanel — read-only window on real LLM run traffic (LlmRun table).
 *
 * Per-agent rollups (runs / success / avg latency / cost) + the most recent
 * runs. Pure render; the page passes the data in. Digits use tabular-nums.
 */

function statusTone(status: string): string {
  if (status === "success") return "text-[var(--ct-accent)]";
  if (status === "fallback") return "text-[#E8B45A]";
  return "text-[var(--ct-status-danger,#E07A6B)]";
}

function fmtCost(v: number): string {
  if (v === 0) return "—";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

export function RunHistoryPanel({ history }: { history: BenchHistory }) {
  if (history.totalRuns === 0) {
    return (
      <p className="py-6 text-center text-sm text-[var(--ct-text-muted)]">
        Aucun run enregistré pour l'instant. Déclenche un agent (Scenario Lab, Investor Memo) ou le chat — chaque appel s'inscrit ici et dans LangSmith.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Per-agent rollups */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(220px,1fr))]">
        {history.rollups.map((r) => (
          <div
            key={r.agentName}
            className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-card)] p-3.5"
          >
            <div className="mb-2 truncate font-mono text-xs text-[var(--ct-text-secondary)]" title={r.agentName}>
              {r.agentName}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-semibold tabular-nums text-[var(--ct-text-primary)]">{r.runs}</span>
              <span className="font-mono text-[10.5px] text-[var(--ct-text-muted)]">runs</span>
            </div>
            <div className="mt-2 flex flex-col gap-1 font-mono text-[10.5px] tabular-nums text-[var(--ct-text-muted)]">
              <div className="flex justify-between">
                <span>succès</span>
                <span className={r.successRate >= 0.98 ? "text-[var(--ct-accent)]" : "text-[#E8B45A]"}>
                  {Math.round(r.successRate * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span>latence moy.</span>
                <span>{r.avgLatencyMs != null ? `${r.avgLatencyMs}ms` : "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>coût total</span>
                <span className="text-[var(--ct-accent)]">{fmtCost(r.totalCostUsd)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent runs table */}
      <div className="overflow-x-auto rounded-xl border border-[var(--ct-border)]">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-[var(--ct-surface-inset)] text-left font-mono text-[10px] uppercase tracking-wider text-[var(--ct-text-muted)]">
              <th className="px-3.5 py-2 font-medium">Agent</th>
              <th className="px-3.5 py-2 font-medium">Modèle</th>
              <th className="px-3.5 py-2 font-medium">Statut</th>
              <th className="px-3.5 py-2 text-right font-medium">Latence</th>
              <th className="px-3.5 py-2 text-right font-medium">Tokens</th>
              <th className="px-3.5 py-2 text-right font-medium">Coût</th>
            </tr>
          </thead>
          <tbody>
            {history.recent.map((row) => (
              <tr key={row.id} className="border-t border-[var(--ct-border)]">
                <td className="max-w-0 truncate px-3.5 py-2 font-mono text-xs text-[var(--ct-text-secondary)]" title={row.agentName}>
                  {row.agentName}
                </td>
                <td className="px-3.5 py-2 font-mono text-xs text-[var(--ct-text-muted)]">{row.model}</td>
                <td className={cn("px-3.5 py-2 font-mono text-xs", statusTone(row.status))}>
                  {row.status}
                  {row.errorType ? ` (${row.errorType})` : ""}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-xs tabular-nums text-[var(--ct-text-muted)]">
                  {row.latencyMs != null ? `${row.latencyMs}ms` : "—"}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-xs tabular-nums text-[var(--ct-text-muted)]">
                  {row.totalTokens != null ? row.totalTokens : "—"}
                </td>
                <td className="px-3.5 py-2 text-right font-mono text-xs tabular-nums text-[var(--ct-accent)]">
                  {row.costUsd != null ? fmtCost(row.costUsd) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
