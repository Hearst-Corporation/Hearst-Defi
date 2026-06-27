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
 */

import { useCallback, useRef, useState } from "react";

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
    <div className="projpv-shell">
      <header className="projpv-toolbar rounded-2xl border border-white/10 bg-black shadow-sm">
        <div className="projpv-toolbar-meta">
          <span className="projpv-badge projpv-badge--preview">Preview input</span>
          <span className="projpv-badge projpv-badge--source">No storage</span>
          <span className="projpv-badge projpv-badge--read">Read-only</span>
          <span className="projpv-badge projpv-badge--ok">Range only</span>
        </div>
        <div className="projpv-toolbar-actions">
          <div className="projpv-modeswitch" role="group" aria-label="Projection methodology">
            <button
              type="button"
              className={cn("projpv-mode", mode === "v0" && "projpv-mode--active")}
              aria-pressed={mode === "v0"}
              onClick={() => selectMode("v0")}
            >
              Deterministic v0
            </button>
            <button
              type="button"
              className={cn("projpv-mode", mode === "v2" && "projpv-mode--active")}
              aria-pressed={mode === "v2"}
              onClick={() => selectMode("v2")}
            >
              Methodology v2
            </button>
          </div>
          <button type="button" className="projpv-reset" onClick={reset} disabled={isLoading}>
            Reset
          </button>
          <button
            type="button"
            className={cn("projpv-run", isLoading && "projpv-run--busy")}
            onClick={() => run(mode)}
            disabled={isLoading}
          >
            {isLoading ? "Running…" : state.kind === "success" ? "Refresh preview" : "Run projection"}
          </button>
        </div>
      </header>

      {/* Editable bounded draft inputs */}
      <section className="projpv-inputs rounded-2xl border border-white/10 bg-black shadow-sm" aria-label="Preview input">
        <div className="projpv-inputs-grid">
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
        <p className="projpv-inputs-foot">
          Allocation: {alloc.map((a) => `${a.weightPct}%`).join(" / ")} preview fixture (not editable). Inputs are
          draft-only — nothing is stored, and APY is always a range.
        </p>
        {localError ? (
          <p className="projpv-inputs-error" role="alert">{localError}</p>
        ) : null}
      </section>

      {state.kind === "idle" ? (
        <div className="projpv-state projpv-state--idle rounded-2xl border border-white/10 bg-black shadow-sm">
          <p className="projpv-state-title">
            {mode === "v2" ? "Methodology v2 — seeded distribution" : "Read-only projection preview"}
          </p>
          <p className="projpv-state-body">
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
        <div className="projpv-state projpv-state--loading rounded-2xl border border-white/10 bg-black shadow-sm" aria-busy="true">
          <p className="projpv-state-title">Building projection…</p>
          <div className="projpv-skel" />
          <div className="projpv-skel projpv-skel--wide" />
        </div>
      ) : null}

      {state.kind === "invalid" ? (
        <div className="projpv-state projpv-state--warn rounded-2xl border border-white/10 bg-black shadow-sm" role="alert">
          <p className="projpv-state-title">Input not accepted</p>
          <p className="projpv-state-body">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="projpv-state projpv-state--error rounded-2xl border border-white/10 bg-black shadow-sm" role="alert">
          <p className="projpv-state-title">Projection unavailable</p>
          <p className="projpv-state-body">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "success" ? (
        <>
          {stale ? (
            <p className="projpv-stale" role="status">
              Inputs changed since this report — run again to refresh.
            </p>
          ) : null}
          <ProjectionReportView artifact={state.artifact} />
        </>
      ) : null}
    </div>
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
    <div className={cn("projpv-field", error && "projpv-field--error")}>
      <label className="projpv-field-label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={field}
        className="projpv-field-input"
        value={value}
        inputMode={inputMode}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        onChange={(e) => onChange(field, e.target.value)}
      />
      {error ? (
        <span className="projpv-field-msg projpv-field-msg--error">{error}</span>
      ) : hint ? (
        <span className="projpv-field-msg">{hint}</span>
      ) : null}
    </div>
  );
}
