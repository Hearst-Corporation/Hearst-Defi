"use client";

/**
 * Projection Report Preview — read-only interactive wrapper.
 *
 * Triggers a SINGLE on-demand projection run against the read-only API from an
 * explicit, visible preview input. No mutation, no storage, no auto-polling, no
 * raw payload / stack traces shown. Renders {@link ProjectionReportView} on
 * success and friendly states otherwise.
 */

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import {
  PREVIEW_PROJECTION_INPUT,
  PREVIEW_PROJECTION_INPUT_V2,
  PREVIEW_PROJECTION_SEED_V2,
  runProjectionPreview,
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

const input = PREVIEW_PROJECTION_INPUT;

export function ProjectionReportPreview() {
  const [mode, setMode] = useState<Mode>("v0");
  const [state, setState] = useState<State>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback((runMode: Mode) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "loading" });
    const payload = runMode === "v2" ? PREVIEW_PROJECTION_INPUT_V2 : PREVIEW_PROJECTION_INPUT;
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
  }, []);

  const selectMode = useCallback(
    (next: Mode) => {
      if (next === mode) return;
      setMode(next);
      // Switching mode invalidates the current report — reset to idle.
      abortRef.current?.abort();
      setState({ kind: "idle" });
    },
    [mode],
  );

  const isLoading = state.kind === "loading";

  return (
    <div className="projpv-shell">
      <header className="projpv-toolbar ct-glass-panel ct-glass-panel--flat">
        <div className="projpv-toolbar-meta">
          <span className="projpv-badge projpv-badge--preview">Preview input</span>
          <span className="projpv-toolbar-input">
            {input.productName} · {input.apyRange?.min}–{input.apyRange?.max}% · {input.horizonMonths}m ·{" "}
            {input.capitalBase?.toLocaleString("en-US")} {input.currency}
            {mode === "v2" ? <> · <span className="projpv-toolbar-seed">seed: {PREVIEW_PROJECTION_SEED_V2}</span></> : null}
          </span>
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

      {state.kind === "idle" ? (
        <div className="projpv-state projpv-state--idle ct-glass-panel ct-glass-panel--flat">
          <p className="projpv-state-title">
            {mode === "v2" ? "Methodology v2 — seeded distribution" : "Read-only projection preview"}
          </p>
          <p className="projpv-state-body">
            {mode === "v2" ? (
              <>
                Run to render a seeded p5 / p50 / p95 distribution for the preview input above. The seed
                is fixed and visible, so the result is reproducible. p50 is a median scenario, not an
                assured return; APY is shown only as a distribution/range.
              </>
            ) : (
              <>
                Run the projection to render a deterministic, read-only report for the preview input above.
                APY is shown only as a range; no figure here is an assured return.
              </>
            )}
          </p>
        </div>
      ) : null}

      {state.kind === "loading" ? (
        <div className="projpv-state projpv-state--loading ct-glass-panel ct-glass-panel--flat" aria-busy="true">
          <p className="projpv-state-title">Building projection…</p>
          <div className="projpv-skel" />
          <div className="projpv-skel projpv-skel--wide" />
        </div>
      ) : null}

      {state.kind === "invalid" ? (
        <div className="projpv-state projpv-state--warn ct-glass-panel ct-glass-panel--flat" role="alert">
          <p className="projpv-state-title">Input not accepted</p>
          <p className="projpv-state-body">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "error" ? (
        <div className="projpv-state projpv-state--error ct-glass-panel ct-glass-panel--flat" role="alert">
          <p className="projpv-state-title">Projection unavailable</p>
          <p className="projpv-state-body">{state.message}</p>
        </div>
      ) : null}

      {state.kind === "success" ? <ProjectionReportView artifact={state.artifact} /> : null}
    </div>
  );
}
