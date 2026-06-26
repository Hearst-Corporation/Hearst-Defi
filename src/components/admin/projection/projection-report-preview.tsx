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
  runProjectionPreview,
  type RunProjectionResult,
} from "@/lib/agentic/product-projection/client";
import type { ProjectionReportArtifact } from "@/lib/agentic/product-projection";
import { ProjectionReportView } from "./projection-report-view";

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; artifact: ProjectionReportArtifact }
  | { kind: "invalid"; message: string }
  | { kind: "error"; message: string };

const input = PREVIEW_PROJECTION_INPUT;

export function ProjectionReportPreview() {
  const [state, setState] = useState<State>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  const run = useCallback(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "loading" });
    void runProjectionPreview(input, controller.signal).then((res: RunProjectionResult) => {
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

  const isLoading = state.kind === "loading";

  return (
    <div className="projpv-shell">
      <header className="projpv-toolbar ct-glass-panel ct-glass-panel--flat">
        <div className="projpv-toolbar-meta">
          <span className="projpv-badge projpv-badge--preview">Preview input</span>
          <span className="projpv-toolbar-input">
            {input.productName} · {input.apyRange?.min}–{input.apyRange?.max}% · {input.horizonMonths}m ·{" "}
            {input.capitalBase?.toLocaleString("en-US")} {input.currency}
          </span>
        </div>
        <button
          type="button"
          className={cn("projpv-run", isLoading && "projpv-run--busy")}
          onClick={run}
          disabled={isLoading}
        >
          {isLoading ? "Running…" : state.kind === "success" ? "Refresh preview" : "Run projection"}
        </button>
      </header>

      {state.kind === "idle" ? (
        <div className="projpv-state projpv-state--idle ct-glass-panel ct-glass-panel--flat">
          <p className="projpv-state-title">Read-only projection preview</p>
          <p className="projpv-state-body">
            Run the projection to render a deterministic, read-only report for the preview input above.
            APY is shown only as a range; no figure here is a guaranteed return.
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
