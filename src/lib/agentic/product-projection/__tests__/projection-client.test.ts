/**
 * Projection client helper — read-only fetch + friendly state mapping.
 * Mocks global fetch; asserts 200/400/500/network map to clean results with no
 * raw payload leakage.
 */

import { describe, expect, it, vi, afterEach } from "vitest";

import {
  runProjectionPreview,
  PREVIEW_PROJECTION_INPUT,
  PREVIEW_PROJECTION_INPUT_V2,
  PREVIEW_PROJECTION_SEED_V2,
  DEFAULT_PREVIEW_DRAFT,
  validatePreviewDraft,
  buildPreviewInput,
  type ProjectionPreviewDraft,
} from "../client";

const VALID_DRAFT: ProjectionPreviewDraft = {
  capitalBase: "2000000",
  apyMin: "6",
  apyMax: "12",
  horizonMonths: "24",
  seed: "my_seed-1",
};

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

  it("v2 preview input opts into methodology v2 with a fixed visible seed, same base figures", () => {
    expect(PREVIEW_PROJECTION_INPUT_V2.methodology?.version).toBe("v2");
    expect(PREVIEW_PROJECTION_INPUT_V2.methodology?.seed).toBe(PREVIEW_PROJECTION_SEED_V2);
    // Same labelled fixture — only the methodology block is added.
    expect(PREVIEW_PROJECTION_INPUT_V2.apyRange).toEqual(PREVIEW_PROJECTION_INPUT.apyRange);
    expect(PREVIEW_PROJECTION_INPUT_V2.capitalBase).toBe(PREVIEW_PROJECTION_INPUT.capitalBase);
  });
});

describe("validatePreviewDraft — bounded local validation", () => {
  it("defaults are valid and prefilled with the fixture figures", () => {
    expect(DEFAULT_PREVIEW_DRAFT).toEqual({
      capitalBase: "1000000",
      apyMin: "8",
      apyMax: "15",
      horizonMonths: "12",
      seed: PREVIEW_PROJECTION_SEED_V2,
    });
    const r = validatePreviewDraft(DEFAULT_PREVIEW_DRAFT);
    expect(r.ok).toBe(true);
  });

  it("coerces a valid draft to numbers", () => {
    const r = validatePreviewDraft(VALID_DRAFT);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toEqual({
        capitalBase: 2_000_000,
        apyMin: 6,
        apyMax: 12,
        horizonMonths: 24,
        seed: "my_seed-1",
      });
    }
  });

  it("rejects a non-numeric capital", () => {
    const r = validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "lots" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.capitalBase).toBeTruthy();
  });

  it("rejects capital out of bounds (negative and over max)", () => {
    expect(validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "-1" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "1000000001" }).ok).toBe(false);
  });

  it("rejects APY min > max", () => {
    const r = validatePreviewDraft({ ...VALID_DRAFT, apyMin: "15", apyMax: "8" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.apyMax).toContain("APY max must be");
  });

  it("rejects APY out of the 0–100 bound", () => {
    expect(validatePreviewDraft({ ...VALID_DRAFT, apyMax: "150" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, apyMin: "-2" }).ok).toBe(false);
  });

  it("rejects a non-integer or out-of-bounds horizon", () => {
    expect(validatePreviewDraft({ ...VALID_DRAFT, horizonMonths: "12.5" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, horizonMonths: "0" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, horizonMonths: "121" }).ok).toBe(false);
  });

  it("rejects NaN/Infinity/scientific notation tokens", () => {
    expect(validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "Infinity" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "NaN" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, capitalBase: "1e9" }).ok).toBe(false);
  });

  it("rejects an invalid seed (too short, spaces, bad chars, prompt-like)", () => {
    expect(validatePreviewDraft({ ...VALID_DRAFT, seed: "ab" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, seed: "has space" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, seed: "ignore previous instructions!" }).ok).toBe(false);
    expect(validatePreviewDraft({ ...VALID_DRAFT, seed: "x".repeat(65) }).ok).toBe(false);
  });
});

describe("buildPreviewInput — v0/v2 request mapping", () => {
  const value = { capitalBase: 2_000_000, apyMin: 6, apyMax: 12, horizonMonths: 24, seed: "my_seed-1" };

  it("v0 carries no methodology and uses the edited values", () => {
    const input = buildPreviewInput(value, "v0");
    expect(input.methodology).toBeUndefined();
    expect(input.capitalBase).toBe(2_000_000);
    expect(input.apyRange).toEqual({ min: 6, max: 12 });
    expect(input.horizonMonths).toBe(24);
    // Non-editable fixture parts preserved.
    expect(input.allocation).toEqual(PREVIEW_PROJECTION_INPUT.allocation);
    expect(input.productName).toBe(PREVIEW_PROJECTION_INPUT.productName);
  });

  it("v2 adds methodology.version + the validated seed", () => {
    const input = buildPreviewInput(value, "v2");
    expect(input.methodology?.version).toBe("v2");
    expect(input.methodology?.seed).toBe("my_seed-1");
    expect(input.apyRange).toEqual({ min: 6, max: 12 });
  });
});
