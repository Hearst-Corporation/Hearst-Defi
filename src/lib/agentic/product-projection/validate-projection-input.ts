/**
 * Product Projection — input validation (pure, allowlist, fail-safe).
 *
 * Parses an untrusted body into a strict ProductProjectionInput. Only the
 * allowlisted fields are read; every other field is dropped. No prompt / free
 * conversation text is ever accepted. Never throws.
 */

import type { ProductProjectionInput, ProvenanceSource } from "./types";

const PRODUCT_TYPES = new Set(["vault", "fund", "strategy", "unknown"]);
const CURRENCIES = new Set(["USD", "USDC"]);
const SOURCES = new Set<ProvenanceSource>([
  "live",
  "attested",
  "estimated",
  "manual",
]);

const MAX_NAME = 200;
const MAX_ARRAY = 50;
const MAX_NUM = 1e15;

export type ValidationResult =
  | { ok: true; value: ProductProjectionInput }
  | { ok: false; error: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function finiteNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

export function validateProjectionInput(raw: unknown): ValidationResult {
  if (!isRecord(raw)) return { ok: false, error: "Body must be a JSON object" };

  const name = raw.productName;
  if (typeof name !== "string" || name.trim().length === 0) {
    return { ok: false, error: "productName is required and must be a string" };
  }
  if (name.length > MAX_NAME) return { ok: false, error: "productName is too long" };

  const type = raw.productType;
  if (typeof type !== "string" || !PRODUCT_TYPES.has(type)) {
    return {
      ok: false,
      error: "productType must be one of: vault, fund, strategy, unknown",
    };
  }

  const value: ProductProjectionInput = {
    productName: name,
    productType: type as ProductProjectionInput["productType"],
  };

  if (typeof raw.productId === "string" && raw.productId.length <= MAX_NAME) {
    value.productId = raw.productId;
  }

  if (raw.currency !== undefined) {
    if (typeof raw.currency !== "string" || !CURRENCIES.has(raw.currency)) {
      return { ok: false, error: "currency must be USD or USDC" };
    }
    value.currency = raw.currency as "USD" | "USDC";
  }

  if (raw.capitalBase !== undefined) {
    const n = finiteNumber(raw.capitalBase);
    if (n === undefined || n < 0 || n > MAX_NUM) {
      return { ok: false, error: "capitalBase must be a non-negative finite number" };
    }
    value.capitalBase = n;
  }

  if (raw.horizonMonths !== undefined) {
    const n = finiteNumber(raw.horizonMonths);
    if (n === undefined || n <= 0 || n > 1200) {
      return { ok: false, error: "horizonMonths must be a positive number ≤ 1200" };
    }
    value.horizonMonths = Math.floor(n);
  }

  if (raw.apyRange !== undefined) {
    if (!isRecord(raw.apyRange)) {
      return { ok: false, error: "apyRange must be an object { min, max }" };
    }
    const min = finiteNumber(raw.apyRange.min);
    const max = finiteNumber(raw.apyRange.max);
    if (min === undefined || max === undefined) {
      return { ok: false, error: "apyRange.min and apyRange.max must be numbers" };
    }
    if (min < 0 || max < 0 || min > max || max > 1000) {
      return { ok: false, error: "apyRange must satisfy 0 ≤ min ≤ max ≤ 1000" };
    }
    value.apyRange = { min, max };
  }

  if (raw.allocation !== undefined) {
    if (!Array.isArray(raw.allocation) || raw.allocation.length > MAX_ARRAY) {
      return { ok: false, error: "allocation must be an array (≤ 50)" };
    }
    const allocation: NonNullable<ProductProjectionInput["allocation"]> = [];
    for (const a of raw.allocation) {
      if (!isRecord(a)) return { ok: false, error: "allocation entry must be an object" };
      const label = a.label;
      const weight = finiteNumber(a.weightPct);
      const source = a.source;
      if (typeof label !== "string" || label.length > MAX_NAME) {
        return { ok: false, error: "allocation.label must be a string" };
      }
      if (weight === undefined || weight < 0 || weight > 100) {
        return { ok: false, error: "allocation.weightPct must be 0..100" };
      }
      if (typeof source !== "string" || !SOURCES.has(source as ProvenanceSource)) {
        return { ok: false, error: "allocation.source must be live/attested/estimated/manual" };
      }
      allocation.push({ label, weightPct: weight, source: source as ProvenanceSource });
    }
    value.allocation = allocation;
  }

  if (raw.assumptions !== undefined) {
    if (!Array.isArray(raw.assumptions) || raw.assumptions.length > MAX_ARRAY) {
      return { ok: false, error: "assumptions must be an array (≤ 50)" };
    }
    const assumptions: NonNullable<ProductProjectionInput["assumptions"]> = [];
    for (const a of raw.assumptions) {
      if (!isRecord(a)) return { ok: false, error: "assumption entry must be an object" };
      const key = a.key;
      const val = a.value;
      const source = a.source;
      if (typeof key !== "string" || key.length > MAX_NAME) {
        return { ok: false, error: "assumption.key must be a string" };
      }
      if (typeof val !== "string" || val.length > MAX_NAME) {
        return { ok: false, error: "assumption.value must be a string" };
      }
      if (typeof source !== "string" || !SOURCES.has(source as ProvenanceSource)) {
        return { ok: false, error: "assumption.source must be live/attested/estimated/manual" };
      }
      assumptions.push({ key, value: val, source: source as ProvenanceSource });
    }
    value.assumptions = assumptions;
  }

  if (raw.methodology !== undefined) {
    if (!isRecord(raw.methodology)) {
      return { ok: false, error: "methodology must be an object" };
    }
    const m = raw.methodology;
    const methodology: NonNullable<ProductProjectionInput["methodology"]> = {};
    if (m.version !== undefined) {
      if (m.version !== "v1" && m.version !== "v2") {
        return { ok: false, error: "methodology.version must be v1 or v2" };
      }
      methodology.version = m.version;
    }
    if (m.seed !== undefined) {
      if (typeof m.seed === "number") {
        if (!Number.isFinite(m.seed)) {
          return { ok: false, error: "methodology.seed number must be finite" };
        }
        methodology.seed = m.seed;
      } else if (typeof m.seed === "string") {
        if (m.seed.length === 0 || m.seed.length > MAX_NAME) {
          return { ok: false, error: "methodology.seed string is empty or too long" };
        }
        methodology.seed = m.seed;
      } else {
        return { ok: false, error: "methodology.seed must be a string or number" };
      }
    }
    if (m.iterations !== undefined) {
      const it = finiteNumber(m.iterations);
      if (it === undefined || it < 1 || it > 1_000_000) {
        return { ok: false, error: "methodology.iterations must be a positive finite number" };
      }
      methodology.iterations = Math.floor(it);
    }
    if (m.confidenceBands !== undefined) {
      if (typeof m.confidenceBands !== "boolean") {
        return { ok: false, error: "methodology.confidenceBands must be a boolean" };
      }
      methodology.confidenceBands = m.confidenceBands;
    }
    value.methodology = methodology;
  }

  return { ok: true, value };
}
