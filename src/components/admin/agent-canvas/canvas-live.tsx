"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  isCanvasStateEvent,
  type CanvasId,
  type CanvasState,
} from "@/lib/canvas/contract";
import { cn } from "@/lib/cn";

import { CanvasSectionView } from "./canvas-section";

/**
 * Live canvas surface (Section 2). Subscribes to `cockpit:canvas-state` window
 * events re-broadcast by the chat hook (the canonical live path while the agent
 * answers), with a degraded autostart fallback that POSTs the first state.
 *
 * Upsert rules (the safety of an eventually-consistent, fire-and-forget channel):
 *  - REVISION-KEYED: a frame with revision <= current is ignored, so a lost /
 *    out-of-order / duplicated CustomEvent can never regress the canvas.
 *  - DIRTY-FIELD MERGE: a field key the admin has edited locally is never
 *    overwritten by an incoming agent frame (keyed on inputBinding.toolInputKey).
 *
 * The rendered state is display-only. The durable truth is the draft + the HITL
 * token; no write happens here — only `CanvasActionButton` mutates, via the
 * two-step token.
 */

export function CanvasLive({
  canvasId,
  initialState,
  objective,
  autostart,
}: {
  canvasId: CanvasId;
  initialState: CanvasState | null;
  objective: string | null;
  autostart: boolean;
}) {
  const [state, setState] = useState<CanvasState | null>(initialState);
  // Field keys the admin has edited locally — agent frames must not clobber them.
  const dirtyKeys = useRef<Set<string>>(new Set());
  const startedRef = useRef(false);

  const applyFrame = useCallback((incoming: CanvasState) => {
    setState((prev) => {
      if (prev && incoming.revision <= prev.revision) return prev; // revision guard
      if (!prev) return incoming;
      // Dirty-field merge: keep any locally-edited field value.
      if (dirtyKeys.current.size === 0) return incoming;
      const merged: CanvasState = {
        ...incoming,
        sections: incoming.sections.map((sec) => ({
          ...sec,
          fields: sec.fields.map((f) => {
            const bind = f.inputBinding?.toolInputKey;
            if (!bind || !dirtyKeys.current.has(bind)) return f;
            const prevField = prev.sections
              .flatMap((s) => s.fields)
              .find((pf) => pf.inputBinding?.toolInputKey === bind);
            return prevField ? { ...f, value: prevField.value } : f;
          }),
        })),
      };
      return merged;
    });
  }, []);

  // Subscribe to the live re-broadcast channel.
  useEffect(() => {
    const onCanvasState = (event: Event): void => {
      const detail = (event as CustomEvent).detail;
      const wrapped = { type: "canvas_state", canvas: detail } as const;
      if (!isCanvasStateEvent(wrapped)) return;
      if (wrapped.canvas.canvasId !== canvasId) return; // not our canvas
      applyFrame(wrapped.canvas);
    };
    window.addEventListener("cockpit:canvas-state", onCanvasState);
    return () => window.removeEventListener("cockpit:canvas-state", onCanvasState);
  }, [canvasId, applyFrame]);

  // Degraded fallback: if the page was opened by the agent (autostart) and no
  // state has arrived yet, POST for the initial composed state.
  useEffect(() => {
    if (startedRef.current) return;
    if (initialState) return;
    if (!autostart) return;
    startedRef.current = true;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/agent-canvas/${canvasId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ objective }),
        });
        if (!res.ok) return;
        const data = (await res.json().catch(() => null)) as unknown;
        const wrapped = { type: "canvas_state", canvas: data } as const;
        if (!cancelled && isCanvasStateEvent(wrapped)) applyFrame(wrapped.canvas);
      } catch {
        // Non-fatal: the live channel may still deliver a frame.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canvasId, initialState, autostart, objective, applyFrame]);

  const onPrefillChat = useCallback((prompt: string) => {
    // Hand back to the chat: pre-fill its input (Section 3). Same window-event
    // seam used elsewhere; ChatKimi listens and sets its input.
    window.dispatchEvent(new CustomEvent("cockpit:chat-prefill", { detail: { prompt } }));
  }, []);

  const onSetField = useCallback(
    (sectionId: string, fieldKey: string, value: string) => {
      setState((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          sections: prev.sections.map((sec) =>
            sec.id !== sectionId
              ? sec
              : {
                  ...sec,
                  fields: sec.fields.map((f) => {
                    if (f.key !== fieldKey) return f;
                    if (f.inputBinding?.toolInputKey) {
                      dirtyKeys.current.add(f.inputBinding.toolInputKey);
                    }
                    return { ...f, value };
                  }),
                },
          ),
        };
      });
    },
    [],
  );

  if (!state) {
    return (
      <div className="ct-canvas-empty">
        <p className="ct-placeholder">
          The agent is opening this workspace…
          <br />
          Ask in the chat to fill it.
        </p>
      </div>
    );
  }

  return (
    <div className="ct-canvas">
      <p className="ct-canvas-disclaimer">{state.disclaimer}</p>
      <div className={cn("ct-canvas-sections", !state.agentLive && "ct-canvas-sections--offline")}>
        {state.sections.map((section) => (
          <CanvasSectionView
            key={section.id}
            canvasId={state.canvasId}
            section={section}
            agentLive={state.agentLive}
            onPrefillChat={onPrefillChat}
            onSetField={onSetField}
          />
        ))}
      </div>
    </div>
  );
}
