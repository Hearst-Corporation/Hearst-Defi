/**
 * Projection client helper — read-only fetch + friendly state mapping.
 * Mocks global fetch; asserts 200/400/500/network map to clean results with no
 * raw payload leakage.
 */

import { describe, expect, it, vi, afterEach } from "vitest";

import {
  runProjectionPreview,
  PREVIEW_PROJECTION_INPUT,
} from "../client";

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runProjectionPreview", () => {
  it("returns the artifact on 200", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { artifact: { id: "x", version: "v0" }, sideEffects: false }));
    const r = await runProjectionPreview(PREVIEW_PROJECTION_INPUT);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.artifact.id).toBe("x");
  });

  it("maps 400 to an invalid result", async () => {
    vi.stubGlobal("fetch", mockFetch(400, { error: "bad input" }));
    const r = await runProjectionPreview(PREVIEW_PROJECTION_INPUT);
    expect(r).toEqual({ ok: false, status: 400, error: "bad input" });
  });

  it("maps 500 to a generic error (no internal detail required)", async () => {
    vi.stubGlobal("fetch", mockFetch(500, { error: "Projection failed output guards" }));
    const r = await runProjectionPreview(PREVIEW_PROJECTION_INPUT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(500);
  });

  it("handles a network failure without throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const r = await runProjectionPreview(PREVIEW_PROJECTION_INPUT);
    expect(r).toEqual({ ok: false, status: 0, error: expect.stringContaining("Network error") });
  });

  it("rejects a malformed 200 body", async () => {
    vi.stubGlobal("fetch", mockFetch(200, { notAnArtifact: true }));
    const r = await runProjectionPreview(PREVIEW_PROJECTION_INPUT);
    expect(r.ok).toBe(false);
  });

  it("preview input keeps APY as a range and is labelled, not live", () => {
    expect(PREVIEW_PROJECTION_INPUT.apyRange).toEqual({ min: 8, max: 15 });
    expect(PREVIEW_PROJECTION_INPUT.productName).toBe("Hearst Yield Vault");
  });
});
