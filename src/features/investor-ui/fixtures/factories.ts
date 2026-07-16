// src/features/investor-ui/fixtures/factories.ts
//
// DRY helpers for building fixture view models. Every block built here is
// FIXTURE-status by default — the architecture guard + fixture tests
// (../__tests__) assert this never silently drifts to LIVE.

import { resolved, type ResolvedViewModel } from "../types/common";

/** A resolved block that is unambiguously a fixture. Overrides are shallow-
 *  merged into the generated defaults (freshness/provenance/generatedAt). */
export function fixtureBlock<T>(
  value: T,
  overrides: Partial<Omit<ResolvedViewModel<T>, "status" | "value">> = {},
): ResolvedViewModel<T> {
  return resolved("FIXTURE", value, {
    provenance: "fixture",
    freshness: "fixture data — not live",
    generatedAt: FIXTURE_GENERATED_AT,
    error: null,
    ...overrides,
  });
}

/** A resolved block explicitly marked unavailable — still FIXTURE-tagged
 *  provenance (this whole file is fixtures), but the STATUS communicates the
 *  business state a real UNAVAILABLE/NOT_CONFIGURED/STALE block would carry. */
export function fixtureUnresolved<T>(
  status: Exclude<ResolvedViewModel<T>["status"], "LIVE" | "FIXTURE">,
  overrides: Partial<Omit<ResolvedViewModel<T>, "status" | "value">> = {},
): ResolvedViewModel<T> {
  return resolved<T>(status, null, {
    provenance: "fixture",
    freshness: "fixture data — not live",
    generatedAt: FIXTURE_GENERATED_AT,
    error: null,
    ...overrides,
  });
}

/** A resolved block with a real value but a non-FIXTURE business status
 *  (e.g. "STALE", "PARTIAL") — for fixtures that deliberately exercise a
 *  degraded-but-populated state. Provenance stays "fixture": this is still
 *  fixture data, only the simulated STATUS differs from the happy path. */
export function fixtureBlockWithStatus<T>(
  status: Exclude<ResolvedViewModel<T>["status"], "LIVE" | "FIXTURE">,
  value: T,
  overrides: Partial<Omit<ResolvedViewModel<T>, "status" | "value">> = {},
): ResolvedViewModel<T> {
  return resolved<T>(status, value, {
    provenance: "fixture",
    freshness: "fixture data — not live",
    generatedAt: FIXTURE_GENERATED_AT,
    error: null,
    ...overrides,
  });
}

/** Fixed instant so fixtures are deterministic across renders/tests. */
export const FIXTURE_GENERATED_AT = "2026-07-01T12:00:00.000Z";
