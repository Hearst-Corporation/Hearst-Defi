import { cn } from "@/lib/cn";
import type { BenchHistory } from "@/lib/bench/history";

/**
 * RunHistoryPanel — read-only window on real LLM run traffic (LlmRun table).
 *
 * Per-agent rollups as flat inset stat tiles + the most recent runs as a
 * hairline table. No cage-in-cage: the AdminSectionCard is the frame, tiles and
 * table sit flat on it. Digits use tabular-nums.
 */

function statusTone(status: string): string {
  if (status === "success") return "text-[var(--ct-accent)]";
  if (status === "fallback") return "text-[var(--ct-status-warning)]";
  return "text-[var(--ct-status-danger)]";
}

function fmtCost(v: number): string {
  if (v === 0) return "—";
  if (v < 0.01) return `$${v.toFixed(4)}`;
  return `$${v.toFixed(2)}`;
}

function StatLine({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="flex items-baseline justify-between font-mono text-[10.5px] tabular-nums">
      <span className="text-[var(--ct-text-faint)]">{label}</span>
      <span className={tone ?? "text-[var(--ct-text-secondary)]"}>{value}</span>
    </div>
  );
}

export function RunHistoryPanel({ history }: { history: BenchHistory }) {
  if (history.totalRuns === 0) {
    return (
      <div className="rounded-xl bg-surface-inset px-5 py-8 text-center">
        <p className="text-sm text-[var(--ct-text-muted)]">
          Aucun run enregistré pour l'instant. Déclenche un agent (Scenario Lab, Investor Memo) ou le chat — chaque appel s'inscrit ici et dans LangSmith.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Per-agent rollups — flat inset tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {history.rollups.map((r) => (
          <div key={r.agentName} className="rounded-xl bg-surface-inset p-4">
            <div
              className="mb-2.5 truncate font-mono text-[11px] text-[var(--ct-text-muted)]"
              title={r.agentName}
            >
              {r.agentName}
            </div>
            <div className="mb-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tabular-nums text-[var(--ct-text-strong)]">
                {r.runs}
              </span>
              <span className="font-mono text-[10px] text-[var(--ct-text-faint)]">runs</span>
            </div>
            <div className="flex flex-col gap-1">
              <StatLine
                label="succès"
                value={`${Math.round(r.successRate * 100)}%`}
                tone={
                  r.successRate >= 0.98
                    ? "text-[var(--ct-accent)]"
                    : "text-[var(--ct-status-warning)]"
                }
              />
              <StatLine label="latence" value={r.avgLatencyMs != null ? `${r.avgLatencyMs}ms` : "—"} />
              <StatLine label="coût" value={fmtCost(r.totalCostUsd)} tone="text-[var(--ct-accent)]" />
            </div>
          </div>
        ))}
      </div>

      {/* Recent runs — hairline table, no outer box */}
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-[var(--ct-border)] text-left font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--ct-text-faint)]">
              <th className="py-2 pr-4 font-medium">Agent</th>
              <th className="py-2 pr-4 font-medium">Modèle</th>
              <th className="py-2 pr-4 font-medium">Statut</th>
              <th className="py-2 pr-4 text-right font-medium">Latence</th>
              <th className="py-2 pr-4 text-right font-medium">Tokens</th>
              <th className="py-2 text-right font-medium">Coût</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ct-border-soft)]">
            {history.recent.map((row) => (
              <tr key={row.id}>
                <td
                  className="max-w-0 truncate py-2 pr-4 font-mono text-xs text-[var(--ct-text-secondary)]"
                  title={row.agentName}
                >
                  {row.agentName}
                </td>
                <td className="py-2 pr-4 font-mono text-xs text-[var(--ct-text-muted)]">{row.model}</td>
                <td className={cn("py-2 pr-4 font-mono text-xs", statusTone(row.status))}>
                  {row.status}
                  {row.errorType ? ` (${row.errorType})` : ""}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums text-[var(--ct-text-muted)]">
                  {row.latencyMs != null ? `${row.latencyMs}ms` : "—"}
                </td>
                <td className="py-2 pr-4 text-right font-mono text-xs tabular-nums text-[var(--ct-text-muted)]">
                  {row.totalTokens != null ? row.totalTokens : "—"}
                </td>
                <td className="py-2 text-right font-mono text-xs tabular-nums text-[var(--ct-accent)]">
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
