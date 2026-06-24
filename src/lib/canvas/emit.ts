import "server-only";

import type { CanvasId, CanvasStateEvent } from "@/lib/canvas/contract";
import { composeCanvasState } from "@/lib/canvas/compose";
import { PRODUCT_CHAT_EVENT_PREFIX } from "@/lib/llm/product-chat-stream";

/**
 * Canvas stream wrapper — sibling of `withProductChatStreamEvents`.
 *
 * When a canvas intent is in flight, this wraps the ALREADY-GUARDED chat stream
 * (so all interleaved canvas text has already passed the compliance guard) and
 * interleaves `canvas_state` event frames over the SAME in-band `\x00HC_EVENT:`
 * multiplexer the product charts use. The client splitter parses both event
 * types; a `canvas_state` event is re-broadcast as a `cockpit:canvas-state`
 * window CustomEvent (see `cockpit-shell/src/chat/useChat.ts`).
 *
 * Like the product wrapper, the canvas content is server-composed deterministically
 * (`composeCanvasState`) — the model's free text streams as the chat answer, the
 * structured canvas is computed, not free-authored. Progression mirrors the chart
 * building→ready pattern: an initial "building" frame, then a "ready" frame as the
 * answer fills in.
 */

function eventFrame(event: CanvasStateEvent): string {
  return `${PRODUCT_CHAT_EVENT_PREFIX}${JSON.stringify(event)}\n`;
}

/**
 * Deterministic canvas response — NO LLM.
 *
 * Used by the deterministic Outreach turn (route): instead of streaming a model
 * answer, the route emits ONE server-composed `canvas_state` frame (the canonical
 * workspace state — building when fields are missing, ready+button when complete)
 * followed by a fixed template assistant text. The client splitter handles it
 * exactly like an LLM turn: the frame re-broadcasts to <CanvasLive>, the text
 * fills the chat bubble. The revision is wall-clock based (monotonic across the
 * canvas lifetime) so this frame supersedes any prior turn's, like
 * `withCanvasStreamEvents`.
 */
export function buildDeterministicCanvasStream(args: {
  canvasId: CanvasId;
  objective?: string;
  agentLive: boolean;
  values?: Record<string, string>;
  /** Fixed assistant text streamed after the canvas frame (the template copy). */
  text: string;
}): ReadableStream<Uint8Array> {
  const { canvasId, objective, agentLive, values, text } = args;
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      const state = composeCanvasState({
        canvasId,
        objective,
        revision: Date.now(),
        agentLive,
        values,
      });
      controller.enqueue(
        encoder.encode(eventFrame({ type: "canvas_state", canvas: state })),
      );
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export function withCanvasStreamEvents(args: {
  stream: ReadableStream<Uint8Array>;
  canvasId: CanvasId;
  objective?: string;
  agentLive: boolean;
  /** Agent-extracted field values merged into the canvas as it fills. */
  values?: Record<string, string>;
}): ReadableStream<Uint8Array> {
  const { stream, canvasId, objective, agentLive, values } = args;
  const encoder = new TextEncoder();
  const reader = stream.getReader();
  // Emit a first "building" frame immediately, then a "ready" frame once the
  // answer has streamed past a small threshold (revision monotonic).
  const READY_THRESHOLD = 80;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      let seenChars = 0;
      let readyEmitted = false;

      // Revisions must be MONOTONIC ACROSS THE CANVAS LIFETIME, not per-turn: the
      // client (CanvasLive) IGNORES any frame whose revision <= the current one
      // (see CanvasState.revision in the contract). The old hardcoded 1 / 2 reset
      // every turn, so a SECOND turn's frames (also 1 / 2) were <= the first turn's
      // revision 2 and were silently DROPPED — the workspace kept the first turn's
      // stale name (e.g. it stayed on the objective-derived label while the chat
      // had already moved to "… Q3"). A wall-clock base makes each turn's frames
      // strictly greater than any prior turn's, so follow-up turns actually apply.
      // (emit.ts is not engine code — Date.now() is allowed here.)
      const baseRevision = Date.now();

      // building (baseRevision).
      const building = composeCanvasState({ canvasId, objective, revision: baseRevision, agentLive, values });
      // Mark all sections "building" for the first frame so the canvas shows it
      // is being composed (the composer's own statuses are the ready shape).
      const buildingFrame: CanvasStateEvent = {
        type: "canvas_state",
        canvas: {
          ...building,
          sections: building.sections.map((s) => ({ ...s, status: "building" as const })),
        },
      };
      controller.enqueue(encoder.encode(eventFrame(buildingFrame)));

      const emitReady = (): void => {
        if (readyEmitted) return;
        readyEmitted = true;
        // ready (baseRevision + 1) — strictly greater than the building frame so
        // it always supersedes it within the turn.
        const ready = composeCanvasState({ canvasId, objective, revision: baseRevision + 1, agentLive, values });
        controller.enqueue(encoder.encode(eventFrame({ type: "canvas_state", canvas: ready })));
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            seenChars += value.length;
            controller.enqueue(value);
            if (seenChars >= READY_THRESHOLD) emitReady();
          }
        }
        emitReady();
      } finally {
        controller.close();
      }
    },
    cancel(reason) {
      void reader.cancel(reason);
    },
  });
}
