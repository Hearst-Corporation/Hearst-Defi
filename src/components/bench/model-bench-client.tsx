"use client";

/**
 * ModelBenchClient — the comparison arena body of /admin/model-bench.
 *
 * A prompt is fanned out to the selected models in parallel (server action),
 * answers land side by side with per-model latency / tokens / cost / compliance.
 * ADR-011: this NEVER changes the product model — it is a comparison lab. Every
 * model call is traced to LangSmith under `bench:<id>`.
 */

import { useCallback, useMemo, useState } from "react";

import { cn } from "@/lib/cn";
import { runBenchAction, type BenchResult } from "@/app/admin/model-bench/actions";
import type { BenchProviderInfo } from "@/lib/bench/providers";

interface Turn {
  prompt: string;
  results: BenchResult[] | null; // null = loading
}

interface Msg {
  role: "user" | "assistant";
  content: string;
}

const PRESETS: { label: string; system?: string; prompt: string }[] = [
  {
    label: "Explication rendement (LP)",
    prompt:
      "Explique en 3 phrases le rendement du Hearst Yield Vault et sa source de cash-flow.",
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
    prompt:
      "Un investisseur demande: 'quel rendement exact vais-je toucher, garanti ?' Réponds honnêtement.",
  },
  {
    label: "Narratif de scénario",
    prompt:
      "Scénario bear: APY range 6.2-8.9%, stressed 4.1%, risk 68, mode defensive. Rédige un court narratif institutionnel avec le format PTAI.",
  },
];

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
      setTurns((t) => [...t, { prompt, results: null }]);

      try {
        const { results } = await runBenchAction({
          messages: nextHistory,
          models,
          system: (rawSystem ?? system).trim() || undefined,
        });
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = { prompt, results };
          return copy;
        });
        // Continue the shared thread from gpt-4.1 (or first ok).
        const thread =
          results.find((r) => r.id === "gpt-4.1" && r.ok)?.text ??
          results.find((r) => r.ok)?.text;
        if (thread) setHistory((h) => [...h, { role: "assistant", content: thread }]);
      } catch {
        setTurns((t) => {
          const copy = [...t];
          copy[copy.length - 1] = {
            prompt,
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
    <div className="flex flex-col gap-4">
      {/* Model chips + tracing badge */}
      <div className="flex flex-wrap items-center gap-2">
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
                "rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors",
                !p.available && "cursor-not-allowed border-[var(--ct-border)] text-[var(--ct-text-muted)] opacity-40 line-through",
                p.available && on && "border-[var(--ct-accent)] bg-[var(--ct-accent)] font-semibold text-[var(--ct-bg-deep)]",
                p.available && !on && "border-[var(--ct-border)] text-[var(--ct-text-muted)] hover:border-[var(--ct-text-muted)]",
              )}
            >
              {p.label}
            </button>
          );
        })}
        <span
          className={cn(
            "ml-auto rounded-full border px-2 py-0.5 font-mono text-[10.5px] tracking-wide",
            tracing
              ? "border-[color-mix(in_srgb,var(--ct-accent)_50%,transparent)] text-[var(--ct-accent)]"
              : "border-[var(--ct-border)] text-[var(--ct-text-muted)]",
          )}
        >
          {tracing ? "LangSmith ON" : "tracing OFF"}
        </span>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            disabled={busy}
            onClick={() => send(p.prompt, p.system ?? "")}
            className="rounded-md border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-2.5 py-1 text-xs text-[var(--ct-text-secondary)] transition-colors hover:border-[var(--ct-text-muted)] disabled:opacity-40"
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* Feed */}
      <div className="flex flex-col gap-6">
        {turns.length === 0 && (
          <p className="py-8 text-center text-sm text-[var(--ct-text-muted)]">
            {available.length} modèle(s) disponible(s). Choisis un preset ou tape ta question — la réponse part à tous les modèles cochés en parallèle.
          </p>
        )}
        {turns.map((turn, i) => (
          <div key={i} className="flex flex-col gap-3">
            <div className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-card)] px-4 py-3">
              <div className="mb-1 font-mono text-[10.5px] uppercase tracking-wider text-[var(--ct-accent)]">
                Prompt
              </div>
              <div className="whitespace-pre-wrap text-sm text-[var(--ct-text-primary)]">{turn.prompt}</div>
            </div>
            <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(300px,1fr))]">
              {turn.results === null
                ? [...selected].map((id) => {
                    const p = providers.find((x) => x.id === id);
                    return (
                      <div key={id} className="rounded-xl border border-[var(--ct-border)] bg-[var(--ct-surface-card)] p-4">
                        <div className="mb-2 text-xs font-semibold">{p?.label ?? id}</div>
                        <div className="animate-pulse font-mono text-xs text-[var(--ct-text-muted)]">▍ réflexion…</div>
                      </div>
                    );
                  })
                : turn.results.map((r) => {
                    const p = providers.find((x) => x.id === r.id);
                    return (
                      <div
                        key={r.id}
                        className={cn(
                          "flex flex-col overflow-hidden rounded-xl border bg-[var(--ct-surface-card)]",
                          r.ok ? "border-[var(--ct-border)]" : "border-[color-mix(in_srgb,var(--ct-status-danger,#E07A6B)_45%,var(--ct-border))]",
                        )}
                      >
                        <div className="flex items-center gap-2 border-b border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-3.5 py-2.5">
                          <span className="text-xs font-semibold">{p?.label ?? r.id}</span>
                          {r.ok && r.compliant === false && (
                            <span className="rounded border border-[color-mix(in_srgb,#E8B45A_50%,transparent)] px-1.5 py-0.5 font-mono text-[9.5px] text-[#E8B45A]">
                              mot interdit
                            </span>
                          )}
                          <span className="ml-auto flex gap-2.5 font-mono text-[10.5px] tabular-nums text-[var(--ct-text-muted)]">
                            <span>{r.ms}ms</span>
                            {r.totalTokens != null && <span>{r.totalTokens}tok</span>}
                            {r.cost != null && (
                              <span className="text-[var(--ct-accent)]">${r.cost.toFixed(4)}</span>
                            )}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "flex-1 whitespace-pre-wrap p-3.5 text-[13.5px] break-words",
                            r.ok ? "text-[var(--ct-text-primary)]" : "font-mono text-xs text-[var(--ct-status-danger,#E07A6B)]",
                          )}
                        >
                          {r.ok ? r.text : `⚠ ${r.error}`}
                        </div>
                      </div>
                    );
                  })}
            </div>
          </div>
        ))}
      </div>

      {/* Composer */}
      <div className="flex flex-col gap-2 border-t border-[var(--ct-border)] pt-4">
        <div className="flex items-center gap-2">
          <label className="font-mono text-[10.5px] uppercase tracking-wider text-[var(--ct-text-muted)]">
            system
          </label>
          <input
            value={system}
            onChange={(e) => setSystem(e.target.value)}
            placeholder="prompt système (vide = défaut Hearst : concis, APY range, mots interdits bannis)"
            className="flex-1 rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-2.5 py-1.5 font-mono text-[11.5px] text-[var(--ct-text-secondary)] focus:border-[var(--ct-text-muted)] focus:outline-none"
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
            className="max-h-44 min-h-[46px] flex-1 resize-none rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-card)] px-3.5 py-2.5 text-sm text-[var(--ct-text-primary)] focus:border-[var(--ct-accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || selected.size === 0 || !input.trim()}
            className="rounded-lg bg-[var(--ct-accent)] px-5 py-3 text-sm font-semibold text-[var(--ct-bg-deep)] transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "…" : "Envoyer"}
          </button>
        </div>
        <p className="font-mono text-[10.5px] text-[var(--ct-text-muted)]">
          {selected.size} modèle(s) — chaque réponse tracée dans LangSmith sous bench:&lt;id&gt;. Lab de comparaison : ne change pas le modèle produit (ADR-011).
        </p>
      </div>
    </div>
  );
}
