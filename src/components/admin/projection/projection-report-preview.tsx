"use client";

/**
 * Projection Report Preview — read-only interactive wrapper with editable,
 * bounded draft inputs.
 *
 * An admin can edit a few headline inputs (capital, APY min/max, horizon, v2
 * seed). Inputs are draft-only and validated LOCALLY before any request — no
 * storage, no mutation, no auto-polling. A single on-demand run hits the
 * read-only API; the backend engine is untouched. No raw payload / stack traces
 * are shown; APY is always a min/max range (min ≤ max); no NaN/Infinity passes.
 *
 * Bento Tailwind (Portfolio canon): graphite-opaque panels, neutral borders,
 * single green accent (#A7FB90) reserved for emphasis/values.
 */

import { useCallback, useRef, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import {
  DEFAULT_PREVIEW_DRAFT,
  PREVIEW_BOUNDS,
  PREVIEW_PROJECTION_INPUT,
  buildPreviewInput,
  validatePreviewDraft,
  runProjectionPreview,
  type ProjectionPreviewDraft,
  type ProjectionDraftField,
  type RunProjectionResult,
} from "@/lib/agentic/product-projection/client";
import type { ProjectionReportArtifact } from "@/lib/agentic/product-projection";
import { ProjectionReportView } from "./projection-report-view";

type Mode = "v0" | "v2";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; artifact: ProjectionReportArtifact }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

type FieldErrors = Partial<Record<ProjectionDraftField, string>>;

const alloc = PREVIEW_PROJECTION_INPUT.allocation ?? [];

const PANEL = "rounded-2xl border border-white/10 bg-surface-card shadow-sm";

export function ProjectionReportPreview() {
  const [mode, setMode] = useState<Mode>("v0");
  const [draft, setDraft] = useState<ProjectionPreviewDraft>(DEFAULT_PREVIEW_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [localError, setLocalError] = useState<string | null>(null);
  const [stale, setStale] = useState(false);
  const [state, setState] = useState<State>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(
    (runMode: Mode) => {
      const result = validatePreviewDraft(draft);
      if (!result.ok) {
        setFieldErrors(result.errors);
        setLocalError("Fix the highlighted fields before running.");
        return; // never call the API with invalid input
      }
      setFieldErrors({});
      setLocalError(null);
      setStale(false);
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setState({ kind: "loading" });
      const payload = buildPreviewInput(result.value, runMode);
      void runProjectionPreview(payload, controller.signal).then((res: RunProjectionResult) => {
        if (controller.signal.aborted) return;
        if (res.ok) {
          setState({ kind: "success", artifact: res.artifact });
        } else if (res.status === 400) {
          setState({ kind: "invalid", message: res.error });
        } else {
          setState({ kind: "error", message: res.error });
        }
      });
    },
    [draft],
  );

  const onField = useCallback(
    (field: ProjectionDraftField, value: string) => {
      setDraft((d) => ({ ...d, [field]: value }));
      setFieldErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));
      setLocalError(null);
      // Editing after a successful run makes the shown report stale.
      setState((s) => {
        if (s.kind === "success") setStale(true);
        return s;
      });
    },
    [],
  );

  const selectMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      setMode(next);
      abortRef.current?.abort();
      setStale(false);
      setLocalError(null);
      setState({ kind: "idle" });
    },
    [mode],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setDraft(DEFAULT_PREVIEW_DRAFT);
    setFieldErrors({});
    setLocalError(null);
    setStale(false);
    setState({ kind: "idle" });
  }, []);

  const isLoading = state.kind === "loading";

  return (
    <div className="flex flex-col gap-4 min-w-0">
      <header className={cn(PANEL, "flex flex-wrap items-center justify-between gap-4 p-4")}>
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <Badge variant="warning">Demo — not linked to current projection</Badge>
          <Badge variant="accent">Fixture input</Badge>
          <SourceChip>No storage</SourceChip>
          <Badge variant="accent">Read-only</Badge>
          <Badge variant="accent">Range only</Badge>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div
            className="inline-flex rounded-lg border border-white/10 bg-white/5 overflow-hidden"
            role="group"
            aria-label="Projection methodology"
          >
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap transition-colors",
                mode === "v0"
                  ? "bg-[#A7FB90]/10 text-[#A7FB90]"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-pressed={mode === "v0"}
              onClick={() => selectMode("v0")}
            >
              Deterministic v0
            </button>
            <button
              type="button"
              className={cn(
                "px-3 py-1.5 text-[11px] font-bold tracking-wide whitespace-nowrap transition-colors border-l border-white/10",
                mode === "v2"
                  ? "bg-[#A7FB90]/10 text-[#A7FB90]"
                  : "text-zinc-500 hover:text-zinc-300",
              )}
              aria-pressed={mode === "v2"}
              onClick={() => selectMode("v2")}
            >
              Methodology v2
            </button>
          </div>
          <button
            type="button"
            className="px-3 py-1.5 rounded-lg border border-white/10 text-[13px] font-medium text-zinc-400 hover:text-white hover:border-white/20 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={reset}
            disabled={isLoading}
          >
            Reset
          </button>
          <button
            type="button"
            className={cn(
              "px-4 py-1.5 rounded-lg border border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[13px] font-semibold text-[#A7FB90] transition-colors whitespace-nowrap hover:bg-[#A7FB90] hover:text-black",
              isLoading && "opacity-60 cursor-progress hover:bg-[#A7FB90]/10 hover:text-[#A7FB90]",
            )}
            onClick={() => run(mode)}
            disabled={isLoading}
          >
            {isLoading ? "Running…" : state.kind === "success" ? "Refresh preview" : "Run projection"}
          </button>
        </div>
      </header>

      {/* Editable bounded draft inputs */}
      <section className={cn(PANEL, "p-4 flex flex-col gap-3")} aria-label="Preview input">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <DraftField
            label="Capital base (USDC)"
            field="capitalBase"
            value={draft.capitalBase}
            error={fieldErrors.capitalBase}
            onChange={onField}
            inputMode="numeric"
            hint={`0–${PREVIEW_BOUNDS.capitalBase.max.toLocaleString("en-US")}`}
          />
          <DraftField
            label="APY min (%)"
            field="apyMin"
            value={draft.apyMin}
            error={fieldErrors.apyMin}
            onChange={onField}
            inputMode="decimal"
            hint={`${PREVIEW_BOUNDS.apy.min}–${PREVIEW_BOUNDS.apy.max}`}
          />
          <DraftField
            label="APY max (%)"
            field="apyMax"
            value={draft.apyMax}
            error={fieldErrors.apyMax}
            onChange={onField}
            inputMode="decimal"
            hint={`≥ APY min`}
          />
          <DraftField
            label="Horizon (months)"
            field="horizonMonths"
            value={draft.horizonMonths}
            error={fieldErrors.horizonMonths}
            onChange={onField}
            inputMode="numeric"
            hint={`${PREVIEW_BOUNDS.horizonMonths.min}–${PREVIEW_BOUNDS.horizonMonths.max}`}
          />
          {mode === "v2" ? (
            <DraftField
              label="Seed (v2)"
              field="seed"
              value={draft.seed}
              error={fieldErrors.seed}
              onChange={onField}
              inputMode="text"
              hint="3–64 · a-z 0-9 - _"
            />
          ) : null}
        </div>
        <p className="text-[11px] text-zinc-500 m-0">
          Allocation: {alloc.map((a) => `${a.weightPct}%`).join(" / ")} preview fixture (not editable). Inputs are
          draft-only — nothing is stored, and APY is always a range.
        </p>
        {localError ? (
          <p className="text-[13px] text-red-400 m-0" role="alert">{localError}</p>
        ) : null}
      </section>

      {state.kind === "idle" ? (
        <div className={cn(PANEL, "p-5 flex flex-col gap-2")}>
          <p className="text-[13px] font-semibold text-white m-0">
            {mode === "v2" ? "Methodology v2 — seeded distribution" : "Read-only projection preview"}
          </p>
          <p className="text-[13px] text-zinc-400 m-0 max-w-[64ch]">
            {mode === "v2" ? (
              <>
                Run to render a seeded p5 / p50 / p95 distribution for the input above. The seed is visible
                and editable, so the result is reproducible. p50 is a median scenario, not an assured
                return; APY is shown only as a distribution/range.
              </>
            ) : (
              <>
                Edit the inputs above, then run to render a deterministic, read-only report. APY is shown
                only as a range; no figure here is an assured return.
              </>
            )}
          </p>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <div className={cn(PANEL, "p-5 flex flex-col gap-2")} aria-busy="true">
          <p className="text-[13px] font-semibold text-white m-0">Building projection…</p>
          <div className="h-3 w-2/5 rounded-sm bg-surface-inset animate-pulse" />
          <div className="h-3 w-3/4 rounded-sm bg-surface-inset animate-pulse" />
        </div>
      ) : null}

      {state.kind === "invalid" ? (
        <div className={cn(PANEL, "p-5 flex flex-col gap-2")} role="alert">
          <p className="text-[13px] font-semibold text-amber-400 m-0">Input not accepted</p>
          <p className="text-[13px] text-zinc-400 m-0 max-w-[64ch]">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className={cn(PANEL, "p-5 flex flex-col gap-2")} role="alert">
          <p className="text-[13px] font-semibold text-red-400 m-0">Projection unavailable</p>
          <p className="text-[13px] text-zinc-400 m-0 max-w-[64ch]">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "success" ? (
        <>
          {stale ? (
            <p
              className="text-[11px] text-amber-400 m-0 px-3 py-2 rounded-lg border border-amber-400/30 bg-amber-400/5"
              role="status"
            >
              Inputs changed since this report — run again to refresh.
            </p>
          ) : null}
          <ProjectionReportView artifact={state.artifact} />
        </>
      ) : null}
    </div>
  );
}

function SourceChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-mono text-zinc-400 whitespace-nowrap">
      {children}
    </span>
  );
}

function DraftField({
  label,
  field,
  value,
  error,
  onChange,
  hint,
  inputMode,
}: {
  label: string;
  field: ProjectionDraftField;
  value: string;
  error?: string;
  onChange: (field: ProjectionDraftField, value: string) => void;
  hint?: string;
  inputMode?: "numeric" | "decimal" | "text";
}) {
  const id = `projpv-field-${field}`;
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={field}
        className={cn(
          "w-full min-w-0 box-border rounded-md border bg-surface-inset text-white font-mono text-[13px] px-3 py-2 transition-colors outline-none focus:border-[#A7FB90]/40",
          error ? "border-red-400/50" : "border-white/10",
        )}
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error ? (
        <span className="text-[10px] font-mono text-red-400">{error}</span>
      ) : hint ? (
        <span className="text-[10px] font-mono text-zinc-500">{hint}</span>
      ) : null}
    </div>
  );
}
