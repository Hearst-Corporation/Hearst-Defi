/**
 * Product Projection — client helper (read-only).
 *
 * Thin fetch wrapper around `POST /api/admin/agentic/projection`. No mutation,
 * no storage, no auto-polling — the caller triggers a single request on demand.
 * The PREVIEW input is an explicit, clearly-labelled fixture (never silent fake
 * data): the UI must badge results built from it as a preview, not "live".
 */

import type { ProductProjectionInput, ProjectionReportArtifact } from "./types";

/**
 * Explicit preview input. Surfaced verbatim in the UI under a "Preview input"
 * badge so a reader always knows these figures are a worked example, not a live
 * product reading. APY stays a range; no number is presented as certain.
 */
export const PREVIEW_PROJECTION_INPUT: ProductProjectionInput = {
  productName: "Hearst Yield Vault",
  productType: "vault",
  capitalBase: 1_000_000,
  currency: "USDC",
  apyRange: { min: 8, max: 15 },
  horizonMonths: 12,
  allocation: [
    { label: "Mining-backed yield", weightPct: 70, source: "attested" },
    { label: "USDC cash buffer", weightPct: 30, source: "manual" },
  ],
  assumptions: [
    { key: "Distribution", value: "Monthly USDC", source: "manual" },
    { key: "Soft lock-up", value: "60 days", source: "manual" },
  ],
};

/** Stable, visible seed for the v2 preview — same seed ⇒ identical distribution. */
export const PREVIEW_PROJECTION_SEED_V2 = "preview-hyv-v2";

/**
 * Methodology v2 preview input: the SAME labelled fixture plus an opt-in seeded
 * distribution (p5/p50/p95). The seed is fixed and visible so the preview is
 * reproducible. The backend clamps `iterations`; nothing here is computed in the UI.
 */
export const PREVIEW_PROJECTION_INPUT_V2: ProductProjectionInput = {
  ...PREVIEW_PROJECTION_INPUT,
  methodology: {
    version: "v2",
    seed: PREVIEW_PROJECTION_SEED_V2,
    iterations: 2000,
    confidenceBands: true,
  },
};

export type RunProjectionResult =
  | { ok: true; artifact: ProjectionReportArtifact }
  | { ok: false; status: number; error: string };

/**
 * Run a single read-only projection. Returns a discriminated result — callers
 * render a friendly state, never a raw payload or a stack trace.
 */
export async function runProjectionPreview(
  input: ProductProjectionInput,
  signal?: AbortSignal,
): Promise<RunProjectionResult> {
  let res: Response;
  try {
    res = await fetch("/api/admin/agentic/projection", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal,
    });
  } catch {
    return { ok: false, status: 0, error: "Network error — could not reach the projection service." };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const msg =
      isRecord(body) && typeof body.error === "string"
        ? body.error
        : res.status === 400
          ? "The projection input was rejected."
          : "The projection service is unavailable right now.";
    return { ok: false, status: res.status, error: msg };
  }

  if (!isRecord(body) || !isRecord(body.artifact)) {
    return { ok: false, status: res.status, error: "Malformed projection response." };
  }
  return { ok: true, artifact: body.artifact as ProjectionReportArtifact };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}
