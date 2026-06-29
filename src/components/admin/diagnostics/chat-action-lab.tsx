"use client";

import { useCallback, useState } from "react";

import type { ChatActionLabReport } from "@/lib/admin/diagnostics/chat-action-lab";
import { CockpitButton as Button } from "@/components/catalyst/cockpit-button";
import { ChatActionScenarioTable } from "./chat-action-scenario-table";
import { ChatActionResultCard } from "./chat-action-result-card";

/**
 * Chat Action Lab — readable demonstration of what the cockpit chat does with
 * critical prompts. Renders the server-computed report and lets the admin
 * re-run it (read-only — the API exercises the real deterministic router, never
 * the LLM, never a write/send).
 */
export function ChatActionLab({ initial }: { initial: ChatActionLabReport }) {
  const [report, setReport] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const runAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/diagnostics/chat-action-lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setReport((await res.json()) as ChatActionLabReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : "request failed");
    } finally {
      setLoading(false);
    }
  }, []);

  const { summary } = report;

  return (
    <div className="flex flex-col gap-4">
      {/* safety + summary banner */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-[var(--ct-border)] bg-surface-card px-4 py-2.5 font-mono text-xs text-[var(--ct-text-muted)]">
        <span>
          Mode: <span className="text-[var(--ct-accent)]">{report.mode}</span>
        </span>
        <span>
          LLM used:{" "}
          <span className="text-[var(--ct-accent)]">
            {String(report.llmUsed)}
          </span>
        </span>
        <span>
          External side effects:{" "}
          <span className="text-[var(--ct-accent)]">
            {String(report.externalSideEffects)}
          </span>
        </span>
        <span>
          DB writes:{" "}
          <span className="text-[var(--ct-accent)]">{report.dbWrites}</span>
        </span>
        <span>
          Result:{" "}
          <span
            className={
              summary.fail > 0
                ? "text-[var(--ct-status-danger)]"
                : "text-[var(--ct-accent)]"
            }
          >
            {summary.pass}/{summary.total} PASS
            {summary.fail > 0 ? ` · ${summary.fail} FAIL` : ""}
            {summary.warn > 0 ? ` · ${summary.warn} WARN` : ""}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void runAll()}
          disabled={loading}
        >
          {loading ? "Running…" : "Run all chat actions"}
        </Button>
        {error ? (
          <span className="text-xs text-[var(--ct-status-danger)]">
            {error}
          </span>
        ) : null}
      </div>

      <ChatActionScenarioTable results={report.results} />

      <div className="grid gap-3 lg:grid-cols-2">
        {report.results.map((r) => (
          <ChatActionResultCard key={r.id} result={r} />
        ))}
      </div>

      {/* raw json drawer — off by default */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-xs text-[var(--ct-text-muted)] underline-offset-2 hover:underline"
        >
          {showRaw ? "Hide" : "Show"} raw diagnostic JSON
        </button>
        {showRaw ? (
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg border border-[var(--ct-border)] bg-surface-page p-3 font-mono text-xs text-[var(--ct-text-muted)]">
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
