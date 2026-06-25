"use client";

// Shared client-side admin-role probe (GET /api/admin/review-mode).
//
// The route is requireAdmin-gated: 200 → admin (returns the chat mode), 401/403
// → not admin, 429 → rate-limited. Several client components need this signal
// (chat presets, admin chat controls) and each used to fire its OWN GET at mount
// — so the LP majority hit the gated route once per component per page load, a
// guaranteed wasted 403 round-trip with nothing to show.
//
// This module dedups the probe to AT MOST ONE network request per session:
//  - the first caller performs the fetch;
//  - concurrent callers share the same in-flight promise (no duplicate request);
//  - the resolved result is cached for the rest of the session, so re-mounts and
//    later callers resolve synchronously from cache (zero network).
//
// It is display-only and fails CLOSED (any error / non-200 → not admin). It is
// NOT a security boundary — the server still gates every admin surface + write.

import type { ChatMode } from "@/lib/llm/chat-modes";

export interface ReviewModeProbeResult {
  /** True only when the route answered 200 (the caller is an admin). */
  isAdmin: boolean;
  /** The admin chat mode when isAdmin, else null. */
  mode: ChatMode | null;
}

const NOT_ADMIN: ReviewModeProbeResult = { isAdmin: false, mode: null };

// Session-scoped cache + in-flight dedup. Module state lives for the page session.
let cached: ReviewModeProbeResult | null = null;
let inFlight: Promise<ReviewModeProbeResult> | null = null;

/**
 * Resolve the admin-role probe, deduped + cached for the session. Returns the
 * cached result immediately on a hit; otherwise issues a single shared fetch.
 * Never throws — fails closed to "not admin".
 */
export function probeReviewMode(): Promise<ReviewModeProbeResult> {
  if (cached) return Promise.resolve(cached);
  if (inFlight) return inFlight;

  inFlight = (async (): Promise<ReviewModeProbeResult> => {
    try {
      const res = await fetch("/api/admin/review-mode");
      if (!res.ok) {
        // 401 (logged out) / 403 (LP) / 429 (rate-limited) → not admin. Do NOT
        // cache a 429 as a definitive answer — leave the cache empty so a later
        // caller can retry once the limiter clears.
        if (res.status === 429) return NOT_ADMIN;
        cached = NOT_ADMIN;
        return NOT_ADMIN;
      }
      const data = (await res.json().catch(() => null)) as
        | { mode?: ChatMode }
        | null;
      const result: ReviewModeProbeResult = {
        isAdmin: true,
        mode: data?.mode ?? null,
      };
      cached = result;
      return result;
    } catch {
      // Network error → fail closed, but don't cache (allow a later retry).
      return NOT_ADMIN;
    } finally {
      inFlight = null;
    }
  })();

  return inFlight;
}

/** TEST-ONLY: clear the session cache + in-flight handle. */
export function __resetReviewModeProbe(): void {
  cached = null;
  inFlight = null;
}
