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

/* ── Editable preview draft (UI-local, bounded, no storage) ──────────────────
 * The preview surface lets an admin edit a few headline inputs. These are
 * draft-only string fields validated locally BEFORE any API call — the backend
 * stays the single source of truth and the engine is untouched. The fixture's
 * non-editable parts (product, currency, allocation, assumptions) are preserved.
 */

export type ProjectionPreviewDraft = {
  capitalBase: string;
  apyMin: string;
  apyMax: string;
  horizonMonths: string;
  seed: string;
};

export const DEFAULT_PREVIEW_DRAFT: ProjectionPreviewDraft = {
  capitalBase: "1000000",
  apyMin: "8",
  apyMax: "15",
  horizonMonths: "12",
  seed: PREVIEW_PROJECTION_SEED_V2,
};

/** Inclusive bounds for the editable preview fields. */
export const PREVIEW_BOUNDS = {
  capitalBase: { min: 0, max: 1_000_000_000 },
  apy: { min: 0, max: 100 },
  horizonMonths: { min: 1, max: 120 },
  seed: { minLen: 3, maxLen: 64, pattern: /^[A-Za-z0-9_-]+$/ },
} as const;

/** Fixed iterations for the v2 preview (backend convention; not user-exposed). */
const PREVIEW_V2_ITERATIONS = 2000;

export type ProjectionDraftField = keyof ProjectionPreviewDraft;

export type ValidatedPreviewValue = {
  capitalBase: number;
  apyMin: number;
  apyMax: number;
  horizonMonths: number;
  seed: string;
};

export type DraftValidationResult =
  | { ok: true; value: ValidatedPreviewValue }
  | { ok: false; errors: Partial<Record<ProjectionDraftField, string>> };

function parseFiniteNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  // Reject anything that isn't a plain decimal number (blocks "Infinity", "1e9", text).
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/**
 * Validate the editable draft. Pure: same draft ⇒ same result. On success returns
 * coerced numeric values; on failure returns per-field messages and NO value, so
 * the caller never calls the API with invalid input. APY is always a min/max range
 * with min ≤ max; no NaN/Infinity can pass.
 */
export function validatePreviewDraft(draft: ProjectionPreviewDraft): DraftValidationResult {
  const errors: Partial<Record<ProjectionDraftField, string>> = {};

  const capitalBase = parseFiniteNumber(draft.capitalBase);
  if (capitalBase === null) {
    errors.capitalBase = "Enter a number.";
  } else if (capitalBase < PREVIEW_BOUNDS.capitalBase.min || capitalBase > PREVIEW_BOUNDS.capitalBase.max) {
    errors.capitalBase = `Must be ${PREVIEW_BOUNDS.capitalBase.min}–${PREVIEW_BOUNDS.capitalBase.max.toLocaleString("en-US")}.`;
  }

  const apyMin = parseFiniteNumber(draft.apyMin);
  if (apyMin === null) {
    errors.apyMin = "Enter a number.";
  } else if (apyMin < PREVIEW_BOUNDS.apy.min || apyMin > PREVIEW_BOUNDS.apy.max) {
    errors.apyMin = `Must be ${PREVIEW_BOUNDS.apy.min}–${PREVIEW_BOUNDS.apy.max}.`;
  }

  const apyMax = parseFiniteNumber(draft.apyMax);
  if (apyMax === null) {
    errors.apyMax = "Enter a number.";
  } else if (apyMax < PREVIEW_BOUNDS.apy.min || apyMax > PREVIEW_BOUNDS.apy.max) {
    errors.apyMax = `Must be ${PREVIEW_BOUNDS.apy.min}–${PREVIEW_BOUNDS.apy.max}.`;
  }

  if (apyMin !== null && apyMax !== null && !errors.apyMin && !errors.apyMax && apyMax < apyMin) {
    errors.apyMax = "APY max must be ≥ APY min.";
  }

  const horizonMonths = parseFiniteNumber(draft.horizonMonths);
  if (horizonMonths === null) {
    errors.horizonMonths = "Enter a number.";
  } else if (!Number.isInteger(horizonMonths)) {
    errors.horizonMonths = "Must be a whole number of months.";
  } else if (horizonMonths < PREVIEW_BOUNDS.horizonMonths.min || horizonMonths > PREVIEW_BOUNDS.horizonMonths.max) {
    errors.horizonMonths = `Must be ${PREVIEW_BOUNDS.horizonMonths.min}–${PREVIEW_BOUNDS.horizonMonths.max}.`;
  }

  const seed = draft.seed.trim();
  if (seed.length < PREVIEW_BOUNDS.seed.minLen || seed.length > PREVIEW_BOUNDS.seed.maxLen) {
    errors.seed = `Seed must be ${PREVIEW_BOUNDS.seed.minLen}–${PREVIEW_BOUNDS.seed.maxLen} characters.`;
  } else if (!PREVIEW_BOUNDS.seed.pattern.test(seed)) {
    errors.seed = "Seed: letters, digits, - and _ only.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      capitalBase: capitalBase as number,
      apyMin: apyMin as number,
      apyMax: apyMax as number,
      horizonMonths: horizonMonths as number,
      seed,
    },
  };
}

/**
 * Build the API input from validated values. Preserves the non-editable fixture
 * parts (product, currency, allocation, assumptions). v0 carries no methodology;
 * v2 adds the seeded methodology with the validated seed. No storage, no mutation.
 */
export function buildPreviewInput(
  value: ValidatedPreviewValue,
  mode: "v0" | "v2",
): ProductProjectionInput {
  const base: ProductProjectionInput = {
    ...PREVIEW_PROJECTION_INPUT,
    capitalBase: value.capitalBase,
    apyRange: { min: value.apyMin, max: value.apyMax },
    horizonMonths: value.horizonMonths,
  };
  if (mode === "v2") {
    base.methodology = {
      version: "v2",
      seed: value.seed,
      iterations: PREVIEW_V2_ITERATIONS,
      confidenceBands: true,
    };
  }
  return base;
}

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
