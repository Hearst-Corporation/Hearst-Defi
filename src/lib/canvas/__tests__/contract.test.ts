/**
 * Canvas contract — shape + guard. The guard gates whether a streamed frame is
 * applied to the canvas, so its strictness on the load-bearing fields is a
 * safety property, not cosmetics.
 */

import { describe, expect, it } from "vitest";

import {
  CANVAS_CONTRACT_VERSION,
  CANVAS_IDS,
  isCanvasId,
  isCanvasStateEvent,
  type CanvasState,
} from "@/lib/canvas/contract";

function validState(): CanvasState {
  return {
    contractVersion: CANVAS_CONTRACT_VERSION,
    canvasId: "create-vault",
    revision: 1,
    audience: "admin",
    title: "t",
    disclaimer: "not guaranteed",
    agentLive: true,
    sections: [],
  };
}

describe("isCanvasId", () => {
  it("accepts every declared canvas id", () => {
    for (const id of CANVAS_IDS) expect(isCanvasId(id)).toBe(true);
  });
  it("rejects unknown ids and non-strings", () => {
    expect(isCanvasId("nope")).toBe(false);
    expect(isCanvasId("")).toBe(false);
    expect(isCanvasId(undefined)).toBe(false);
    expect(isCanvasId(42)).toBe(false);
  });
});

describe("isCanvasStateEvent", () => {
  it("accepts a well-formed canvas_state event", () => {
    expect(isCanvasStateEvent({ type: "canvas_state", canvas: validState() })).toBe(true);
  });
  it("rejects a foreign event type (e.g. product_chart)", () => {
    expect(isCanvasStateEvent({ type: "product_chart", chart: { id: "x" } })).toBe(false);
  });
  it("rejects a contract-version mismatch", () => {
    const bad = { type: "canvas_state", canvas: { ...validState(), contractVersion: 999 } };
    expect(isCanvasStateEvent(bad)).toBe(false);
  });
  it("rejects an unknown canvasId", () => {
    const bad = { type: "canvas_state", canvas: { ...validState(), canvasId: "ghost" } };
    expect(isCanvasStateEvent(bad)).toBe(false);
  });
  it("rejects a non-numeric revision", () => {
    const bad = { type: "canvas_state", canvas: { ...validState(), revision: "1" } };
    expect(isCanvasStateEvent(bad)).toBe(false);
  });
  it("rejects null / non-object", () => {
    expect(isCanvasStateEvent(null)).toBe(false);
    expect(isCanvasStateEvent("canvas_state")).toBe(false);
  });
});
