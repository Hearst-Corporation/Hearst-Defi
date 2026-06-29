"use client";

import { useCallback, useMemo, useState } from "react";

import type { DiagnosticSuiteResult } from "@/lib/admin/diagnostics/types";
import { DiagnosticResultTable } from "./diagnostic-result-table";
import { DiagnosticRunCard } from "./diagnostic-run-card";

type SuiteMeta = { name: string; label: string; blurb: string };

export function DiagnosticCenter({
  suites,
  initial,
}: {
  suites: SuiteMeta[];
  initial: Record<string, DiagnosticSuiteResult>;
}) {
  const [results, setResults] =
    useState<Record<string, DiagnosticSuiteResult>>(initial);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errorBy, setErrorBy] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<string>(suites[0]?.name ?? "");
  const [showRaw, setShowRaw] = useState(false);
  const [copied, setCopied] = useState(false);

  const runSuite = useCallback(async (name: string) => {
    setLoading((s) => ({ ...s, [name]: true }));
    setErrorBy((e) => ({ ...e, [name]: "" }));
    try {
      const res = await fetch(`/api/admin/diagnostics/${name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrorBy((e) => ({
          ...e,
          [name]: body.error ?? `HTTP ${res.status}`,
        }));
        return;
      }
      const data = (await res.json()) as DiagnosticSuiteResult;
      setResults((r) => ({ ...r, [name]: data }));
      setSelected(name);
    } catch (err) {
      setErrorBy((e) => ({
        ...e,
        [name]: err instanceof Error ? err.message : "request failed",
      }));
    } finally {
      setLoading((s) => ({ ...s, [name]: false }));
    }
  }, []);

  const current = results[selected];
  const failures = useMemo(
    () =>
      (current?.results ?? []).filter(
        (r) => r.status === "fail" || r.status === "warn",
      ),
    [current],
  );

  const copyJson = useCallback(() => {
    if (!current) return;
    void navigator.clipboard
      ?.writeText(JSON.stringify(current, null, 2))
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      });
  }, [current]);

  return (
    <div className="flex flex-col gap-5">
      {/* status cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {suites.map((s) => (
          <DiagnosticRunCard
            key={s.name}
            label={s.label}
            blurb={s.blurb}
            result={results[s.name]}
            loading={!!loading[s.name]}
            active={selected === s.name}
            onRun={() => runSuite(s.name)}
            onSelect={() => setSelected(s.name)}
          />
        ))}
      </div>

      {current ? (
        <div className="flex flex-col gap-4">
          {/* safety banner */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-lg border border-[var(--ct-border)] bg-surface-card px-4 py-2.5 font-mono text-xs text-[var(--ct-text-muted)]">
            <span>
              Mode:{" "}
              <span className="text-[var(--ct-accent)]">{current.mode}</span>
            </span>
            <span>
              External side effects:{" "}
              <span className="text-[var(--ct-accent)]">
                {String(current.externalSideEffects)}
              </span>
            </span>
            <span>
              DB writes:{" "}
              <span className="text-[var(--ct-accent)]">{current.dbWrites}</span>
            </span>
            <span>
              Runtime touched:{" "}
              <span className="text-[var(--ct-accent)]">
                {String(current.runtimeTouched)}
              </span>
            </span>
          </div>

          {errorBy[selected] ? (
            <p className="text-xs text-[var(--ct-status-danger)]">
              Last run error: {errorBy[selected]}
            </p>
          ) : null}

          {/* failure map */}
          <div>
            <h3 className="ct-bento-label mb-2">Failure map</h3>
            {failures.length === 0 ? (
              <p className="rounded-lg border border-[var(--ct-border)] bg-surface-card px-4 py-2.5 text-xs text-[var(--ct-accent)]">
                ✓ No failing static invariants in this suite.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {failures.map((f) => (
                  <li
                    key={f.id}
                    className="rounded-lg border border-[var(--ct-border)] bg-surface-card px-3 py-2 text-xs text-[var(--ct-text-secondary)]"
                  >
                    <span
                      className={
                        f.status === "fail"
                          ? "font-bold text-[var(--ct-status-danger)]"
                          : "font-bold text-[var(--ct-status-warning)]"
                      }
                    >
                      {f.severity}
                    </span>{" "}
                    {f.label} —{" "}
                    <span className="text-[var(--ct-text-tertiary)]">
                      {f.actual}
                    </span>
                    {f.likelyFile ? (
                      <span className="block font-mono text-xs text-[var(--ct-text-faint)]">
                        {f.likelyFile}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* result table */}
          <DiagnosticResultTable results={current.results} />

          {/* raw json */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowRaw((v) => !v)}
              className="text-xs text-[var(--ct-text-muted)] underline-offset-2 hover:underline"
            >
              {showRaw ? "Hide" : "Show"} raw diagnostic JSON
            </button>
            <button
              type="button"
              onClick={copyJson}
              className="text-xs text-[var(--ct-text-muted)] underline-offset-2 hover:underline"
            >
              {copied ? "Copied ✓" : "Copy report JSON"}
            </button>
          </div>
          {showRaw ? (
            <pre className="max-h-96 overflow-auto rounded-lg border border-[var(--ct-border)] bg-surface-page p-3 font-mono text-xs text-[var(--ct-text-muted)]">
              {JSON.stringify(current, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-[var(--ct-text-tertiary)]">
          Select a suite and press “Run suite”.
        </p>
      )}
    </div>
  );
}
