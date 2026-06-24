/**
 * withCanvasStreamEvents — revision monotonicity (state-sync root cause).
 *
 * The client (CanvasLive) IGNORES any frame with `revision <= current`. The bug
 * was that emit hardcoded revision 1 / 2 every turn, so a SECOND turn's frames
 * were <= the first turn's revision 2 and got dropped — the workspace kept the
 * first turn's stale name. These tests pin that:
 *   - within a turn, ready.revision > building.revision;
 *   - a follow-up turn's frames all outrank the previous turn's, so they apply.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  withCanvasStreamEvents,
  buildDeterministicCanvasStream,
} from "@/lib/canvas/emit";

const EVENT_PREFIX = "\x00HC_EVENT:";

interface MiniSection {
  id: string;
  status: string;
  fields: Array<{ key: string; value: string }>;
  actions: Array<{ toolId: string; input?: Record<string, unknown> }>;
}
interface MiniCanvas {
  canvasId: string;
  revision: number;
  sections: MiniSection[];
}

async function readDeterministic(
  stream: ReadableStream<Uint8Array>,
): Promise<{ frames: MiniCanvas[]; text: string }> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) buf += dec.decode(value, { stream: true });
  }
  const frames: MiniCanvas[] = [];
  let text = "";
  for (const line of buf.split("\n")) {
    const idx = line.indexOf(EVENT_PREFIX);
    if (idx === -1) {
      text += line;
      continue;
    }
    text += line.slice(0, idx);
    try {
      const ev = JSON.parse(line.slice(idx + EVENT_PREFIX.length)) as {
        type?: string;
        canvas?: MiniCanvas;
      };
      if (ev.type === "canvas_state" && ev.canvas) frames.push(ev.canvas);
    } catch {
      /* ignore */
    }
  }
  return { frames, text };
}

function streamFromText(text: string): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(enc.encode(text));
      controller.close();
    },
  });
}

async function collectRevisions(stream: ReadableStream<Uint8Array>): Promise<number[]> {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) buf += dec.decode(value, { stream: true });
  }
  const revisions: number[] = [];
  for (const line of buf.split("\n")) {
    const idx = line.indexOf(EVENT_PREFIX);
    if (idx === -1) continue;
    try {
      const ev = JSON.parse(line.slice(idx + EVENT_PREFIX.length)) as {
        type?: string;
        canvas?: { revision?: number };
      };
      if (ev.type === "canvas_state" && typeof ev.canvas?.revision === "number") {
        revisions.push(ev.canvas.revision);
      }
    } catch {
      /* ignore non-event lines (the streamed answer text) */
    }
  }
  return revisions;
}

afterEach(() => vi.restoreAllMocks());

describe("withCanvasStreamEvents — monotonic revisions", () => {
  it("emits the ready frame with a strictly greater revision than the building frame", async () => {
    const revs = await collectRevisions(
      withCanvasStreamEvents({
        stream: streamFromText("x".repeat(200)), // > READY_THRESHOLD so ready emits
        canvasId: "outreach",
        objective: "lance une campagne",
        agentLive: true,
      }),
    );
    expect(revs.length).toBeGreaterThanOrEqual(2);
    expect(revs[revs.length - 1]!).toBeGreaterThan(revs[0]!);
  });

  it("makes a follow-up turn's frames outrank every frame of the previous turn", async () => {
    const now = vi.spyOn(Date, "now");

    now.mockReturnValue(1_000_000);
    const turn1 = await collectRevisions(
      withCanvasStreamEvents({
        stream: streamFromText("y".repeat(200)),
        canvasId: "outreach",
        agentLive: true,
      }),
    );

    now.mockReturnValue(2_000_000);
    const turn2 = await collectRevisions(
      withCanvasStreamEvents({
        stream: streamFromText("z".repeat(200)),
        canvasId: "outreach",
        agentLive: true,
      }),
    );

    // Every turn-2 frame must exceed every turn-1 frame, so CanvasLive's
    // `revision <= current` guard APPLIES turn 2 instead of dropping it.
    expect(Math.min(...turn2)).toBeGreaterThan(Math.max(...turn1));
  });
});

describe("buildDeterministicCanvasStream (deterministic outreach turn — NO LLM)", () => {
  it("turn 1 (no values): emits ONE building frame with NO draft button + the text", async () => {
    const { frames, text } = await readDeterministic(
      buildDeterministicCanvasStream({
        canvasId: "outreach",
        objective:
          "lance une campagne outreach distributeurs institutionnels pour Hearst Yield",
        agentLive: true,
        text: "QUESTION_NAME_KIND",
      }),
    );
    expect(frames).toHaveLength(1);
    const frame = frames[0]!;
    expect(frame.canvasId).toBe("outreach");
    // Campaign section is still "building" and surfaces NO write action.
    const campaign = frame.sections.find((s) => s.id === "outreach-campaign")!;
    expect(campaign.status).toBe("building");
    const allActions = frame.sections.flatMap((s) => s.actions).map((a) => a.toolId);
    expect(allActions).not.toContain("create_campaign_draft");
    expect(allActions).toHaveLength(0); // nothing actionable at all
    // Name + kind fields show no fabricated value.
    const nameField = campaign.fields.find((f) => f.key === "name")!;
    const kindField = campaign.fields.find((f) => f.key === "kind")!;
    expect(nameField.value).toBe("—");
    expect(kindField.value).toBe("—");
    // The deterministic template text rides after the frame.
    expect(text).toContain("QUESTION_NAME_KIND");
  });

  it("turn 2 (name + kind): emits a ready frame whose button payload name EQUALS the workspace name", async () => {
    const { frames } = await readDeterministic(
      buildDeterministicCanvasStream({
        canvasId: "outreach",
        objective: "crée un draft",
        agentLive: true,
        values: { name: "Distributeurs Institutionnels Q3", kind: "cold" },
        text: "ACK",
      }),
    );
    const frame = frames[0]!;
    const campaign = frame.sections.find((s) => s.id === "outreach-campaign")!;
    expect(campaign.status).toBe("ready");
    const nameFieldValue = campaign.fields.find((f) => f.key === "name")!.value;
    const action = frame.sections
      .flatMap((s) => s.actions)
      .find((a) => a.toolId === "create_campaign_draft")!;
    expect(action).toBeTruthy();
    // #5 — workspace name and the action payload name are the SAME canonical value.
    expect(nameFieldValue).toBe("Distributeurs Institutionnels Q3");
    expect(action.input?.name).toBe("Distributeurs Institutionnels Q3");
    expect(action.input?.kind).toBe("cold");
  });

  it("uses a wall-clock revision (monotonic across turns, not the legacy 1/2)", async () => {
    const { frames } = await readDeterministic(
      buildDeterministicCanvasStream({
        canvasId: "outreach",
        agentLive: true,
        text: "x",
      }),
    );
    expect(frames[0]!.revision).toBeGreaterThan(1_000_000_000);
  });
});
