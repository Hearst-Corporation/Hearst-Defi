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

      // Revision 1: building.
      const building = composeCanvasState({ canvasId, objective, revision: 1, agentLive, values });
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
        const ready = composeCanvasState({ canvasId, objective, revision: 2, agentLive, values });
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
