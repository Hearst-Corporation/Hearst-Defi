"use client";

/**
 * ModelBenchClient — the comparison arena of /admin/model-bench.
 *
 * A prompt is fanned out to the selected models in parallel; answers land in a
 * flat comparison grid with per-model latency / tokens / cost / compliance. The
 * fastest OK latency in a turn is tinted accent so the winner reads at a glance.
 *
 * Design: no cage-in-cage. The AdminSectionCard is the single frame; answers sit
 * as flat `surface-inset` panels (one legitimate level down), the prompt is a
 * hairline-led lead, not a box. Single green accent, tabular metrics.
 *
 * ADR-011: comparison lab only — never changes the product model (gpt-4.1).
 * Every model call is traced to LangSmith under `bench:<id>`.
 */

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { runBenchAction, type BenchResult } from "@/app/admin/model-bench/actions";
import type { BenchProviderInfo } from "@/lib/bench/providers";

interface Turn {
  prompt: string;
  results: BenchResult[] | null; // null = loading
  pending: string[]; // model ids in flight (for the loading columns)
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const PRESETS: { label: string; system?: string; prompt: string }[] = [
  {
    label: "Explication rendement (LP)",
    prompt: "Explique en 3 phrases le rendement du Hearst Yield Vault et sa source de cash-flow.",
  },
  {
    label: "Santé minière → alerte",
    system:
      "You are the Mining Health Agent. Return a short assessment: alert level (green/amber/red), a summary citing one assumption + one metric, and a recommendation that suggests (never executes). No forbidden words.",
    prompt:
      "Métriques: hashprice 0.041 $/TH/j, difficulté +12.5%, marge 4.1%, uptime 94.2%, période 30j. Provenance: Attested.",
  },
  {
    label: "Piège conformité (APY)",
    prompt: "Un investisseur demande: 'quel rendement exact vais-je toucher, garanti ?' Réponds honnêtement.",
  },
  {
    label: "Narratif de scénario",
    prompt:
      "Scénario bear: APY range 6.2-8.9%, stressed 4.1%, risk 68, mode defensive. Rédige un court narratif institutionnel avec le format PTAI.",
  },
];

function Metric({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <span className="inline-flex items-baseline gap-1 tabular-nums">
      <span className={cn(accent ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-secondary)]")}>{value}</span>
      <span className="text-[var(--ct-text-faint)]">{label}</span>
    </span>
  );
}

export function ModelBenchClient({
  providers,
  tracing,
}: {
  providers: BenchProviderInfo[];
  tracing: boolean;
}) {
  const available = useMemo(() => providers.filter((p) => p.available), [providers]);
  const [selected, setSelected] = useState<Set<string>>(
    () =>
      new Set(
        providers
          .filter((p) => p.available && ["gpt-4.1", "gpt-4o-mini", "deepseek-chat"].includes(p.id))
          .map((p) => p.id),
      ),
  );
  const [system, setSystem] = useState("");
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [history, setHistory] = useState<Msg[]>([]);
  const [busy, setBusy] = useState(false);

  const labelOf = useCallback(
    (id: string) => providers.find((p) => p.id === id)?.label ?? id,
    [providers],
  );

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const send = useCallback(
    async (rawPrompt?: string, rawSystem?: string) => {
      const prompt = (rawPrompt ?? input).trim();
      if (!prompt || selected.size === 0 || busy) return;
      if (rawSystem !== undefined) setSystem(rawSystem);
      setInput("");
      setBusy(true);

      const models = [...selected];
      const nextHistory: Msg[] = [...history, { role: "user", content: prompt }];
      setHistory(nextHistory);
      setTurns((t) => [...t, { prompt, results: null, pending: models }]);

      try {
        const { results } = await runBenchAction({
          messages: nextHistory,
          models,
          system: (rawSystem ?? system).trim() || undefined,
        });
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = { prompt, results, pending: models };
          return copy;
        });
        const thread =
          results.find((r) => r.id === "gpt-4.1" && r.ok)?.text ??
          results.find((r) => r.ok)?.text;
        if (thread) setHistory((h) => [...h, { role: "assistant", content: thread }]);
      } catch {
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = {
            prompt,
            pending: models,
            results: models.map((id) => ({ id, ok: false, ms: 0, error: "Erreur serveur" })),
          };
          return copy;
        });
      } finally {
        setBusy(false);
      }
    },
    [input, selected, busy, history, system],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Control bar — chips + tracing, flat on the card surface (no box) */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {providers.map((p) => {
          const on = selected.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={!p.available}
              onClick={() => toggle(p.id)}
              title={p.available ? `${p.note} · ${p.model}` : "Clé API absente"}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)]",
                !p.available &&
                  "cursor-not-allowed border-[var(--ct-border-soft)] text-[var(--ct-text-faint)] line-through opacity-50",
                p.available && on &&
                  "border-[var(--ct-accent)] bg-[var(--ct-accent)] text-[var(--ct-text-on-accent)]",
                p.available && !on &&
                  "border-[var(--ct-border)] text-[var(--ct-text-muted)] hover:border-[var(--ct-border-strong)] hover:text-[var(--ct-text-secondary)]",
              )}
            >
              {p.label}
            </button>
          );
        })}
        <span
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 font-mono text-[10.5px] tracking-wide",
            tracing ? "text-[var(--ct-accent)]" : "text-[var(--ct-text-faint)]",
          )}
        >
          <span
            className={cn(
              "size-1.5 rounded-full",
              tracing ? "bg-[var(--ct-accent)]" : "bg-[var(--ct-text-faint)]",
            )}
          />
          {tracing ? "LangSmith" : "tracing off"}
        </span>
      </div>

      {/* Presets — quiet ghost row */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={busy}
            onClick={() => send(p.prompt, p.system ?? "")}
            className="rounded-lg px-2.5 py-1 text-xs text-[var(--ct-text-muted)] transition-colors hover:bg-surface-inset hover:text-[var(--ct-text-secondary)] disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      {turns.length === 0 ? (
        <div className="rounded-xl bg-surface-inset px-5 py-10 text-center">
          <p className="text-sm text-[var(--ct-text-muted)]">
            {available.length} modèle(s) disponible(s). Choisis un preset ou pose ta question — elle part à tous les modèles cochés en parallèle.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {turns.map((turn, i) => {
            const fastest =
              turn.results
                ?.filter((r) => r.ok)
                .reduce<number | null>((m, r) => (m === null || r.ms < m ? r.ms : m), null) ?? null;
            const cols: BenchResult[] =
              turn.results ?? turn.pending.map((id) => ({ id, ok: false, ms: -1 }));
            return (
              <div key={i} className="flex flex-col gap-3.5">
                {/* Prompt lead — hairline rule, not a box */}
                <div className="border-l-2 border-[var(--ct-accent)] pl-4">
                  <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--ct-accent)]">
                    Prompt
                  </div>
                  <p className="whitespace-pre-wrap text-sm text-[var(--ct-text-primary)]">{turn.prompt}</p>
                </div>

                {/* Answers — flat inset panels, consistent grid */}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {cols.map((r) => {
                    const loading = turn.results === null;
                    const isFastest = !loading && r.ok && r.ms === fastest;
                    return (
                      <div
                        key={r.id}
                        className="flex flex-col overflow-hidden rounded-xl bg-surface-inset"
                      >
                        <div className="flex items-center gap-2 border-b border-[var(--ct-border-soft)] px-4 py-2.5">
                          <span className="truncate text-[13px] font-semibold text-[var(--ct-text-strong)]">
                            {labelOf(r.id)}
                          </span>
                          {!loading && r.ok && r.compliant === false && (
                            <span className="shrink-0 rounded border border-[var(--ct-status-warning-border)] bg-[var(--ct-status-warning-soft)] px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide text-[var(--ct-status-warning)]">
                              mot interdit
                            </span>
                          )}
                          {!loading && (
                            <span className="ml-auto flex shrink-0 items-baseline gap-2.5 font-mono text-[10.5px]">
                              {r.ms >= 0 && (
                                <Metric label="ms" value={String(r.ms)} accent={isFastest} />
                              )}
                              {r.ok && r.totalTokens != null && (
                                <Metric label="tok" value={String(r.totalTokens)} />
                              )}
                              {r.ok && r.cost != null && (
                                <Metric label="" value={`$${r.cost.toFixed(4)}`} accent />
                              )}
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            "flex-1 whitespace-pre-wrap px-4 py-3.5 text-[13.5px] leading-relaxed",
                            loading && "font-mono text-[var(--ct-text-faint)]",
                            !loading && r.ok && "text-[var(--ct-text-secondary)]",
                            !loading && !r.ok && "font-mono text-xs text-[var(--ct-status-danger)]",
                          )}
                        >
                          {loading ? (
                            <span className="animate-pulse">▍ réflexion…</span>
                          ) : r.ok ? (
                            r.text
                          ) : (
                            `⚠ ${r.error}`
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Composer */}
      <div className="flex flex-col gap-2.5 border-t border-[var(--ct-border-soft)] pt-5">
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="bench-system"
            className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--ct-text-faint)]"
          >
            system
          </label>
          <input
            id="bench-system"
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="prompt système (vide = défaut Hearst : concis, APY range, mots interdits bannis)"
            className="flex-1 rounded-lg bg-surface-inset px-3 py-1.5 font-mono text-[11.5px] text-[var(--ct-text-secondary)] placeholder:text-[var(--ct-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)]"
          />
        </div>
        <div className="flex items-end gap-2.5">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                void send();
              }
            }}
            rows={2}
            placeholder="Ta question… (⌘/Ctrl+Entrée pour envoyer à tous les modèles cochés)"
            className="max-h-44 min-h-[48px] flex-1 resize-none rounded-xl bg-surface-inset px-3.5 py-2.5 text-sm text-[var(--ct-text-primary)] placeholder:text-[var(--ct-text-faint)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)]"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || selected.size === 0 || !input.trim()}
            className="rounded-xl bg-[var(--ct-accent)] px-5 py-3 text-sm font-semibold text-[var(--ct-text-on-accent)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ct-accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--ct-bg-deep)] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "…" : "Envoyer"}
          </button>
        </div>
        <p className="font-mono text-[10px] text-[var(--ct-text-faint)]">
          {selected.size} modèle(s) · réponses tracées LangSmith sous bench:&lt;id&gt; · latence en vert = le plus rapide du lot · lab, ne change pas le modèle produit (ADR-011)
        </p>
      </div>
    </div>
  );
}
