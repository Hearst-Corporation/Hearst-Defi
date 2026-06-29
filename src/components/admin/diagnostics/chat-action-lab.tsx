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
    <div className="flex flex-col gap-(--ct-space-4)">
      {/* safety + summary banner */}
      <div className="flex flex-wrap items-center gap-x-(--ct-space-5) gap-y-(--ct-space-1) rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-card px-(--ct-space-4) py-(--ct-space-2_5) mono text-[length:var(--ct-text-xs)] ct-text-muted">
        <span>
          Mode: <span className="ct-text-accent">{report.mode}</span>
        </span>
        <span>
          LLM used:{" "}
          <span className="ct-text-accent">
            {String(report.llmUsed)}
          </span>
        </span>
        <span>
          External side effects:{" "}
          <span className="ct-text-accent">
            {String(report.externalSideEffects)}
          </span>
        </span>
        <span>
          DB writes:{" "}
          <span className="ct-text-accent">{report.dbWrites}</span>
        </span>
        <span>
          Result:{" "}
          <span className={summary.fail > 0 ? "ct-status-danger" : "ct-text-accent"}>
            {summary.pass}/{summary.total} PASS
            {summary.fail > 0 ? ` · ${summary.fail} FAIL` : ""}
            {summary.warn > 0 ? ` · ${summary.warn} WARN` : ""}
          </span>
        </span>
      </div>

      <div className="flex items-center gap-(--ct-space-3)">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void runAll()}
          disabled={loading}
        >
          {loading ? "Running…" : "Run all chat actions"}
        </Button>
        {error ? (
          <span className="text-[length:var(--ct-text-xs)] ct-status-danger">
            {error}
          </span>
        ) : null}
      </div>

      <ChatActionScenarioTable results={report.results} />

      <div className="grid gap-(--ct-space-3) lg:grid-cols-2">
        {report.results.map((r) => (
          <ChatActionResultCard key={r.id} result={r} />
        ))}
      </div>

      {/* raw json drawer — off by default */}
      <div>
        <button
          type="button"
          onClick={() => setShowRaw((v) => !v)}
          className="text-[length:var(--ct-text-xs)] ct-text-muted underline-offset-2 hover:underline"
        >
          {showRaw ? "Hide" : "Show"} raw diagnostic JSON
        </button>
        {showRaw ? (
          <pre className="mt-(--ct-space-2) max-h-96 overflow-auto rounded-(--ct-radius-lg) border border-[var(--ct-border)] bg-surface-page p-(--ct-space-3) mono text-[length:var(--ct-text-xs)] ct-text-muted">
            {JSON.stringify(report, null, 2)}
          </pre>
        ) : null}
      </div>
    </div>
  );
}
