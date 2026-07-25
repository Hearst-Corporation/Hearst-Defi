/**
 * Thin wrapper around Sentry SDK for structured error / event capture.
 *
 * All exports are no-ops when SENTRY_DSN is absent — the project must boot
 * cleanly without Sentry configured (OPT flag in env schema).
 *
 * Used by logger.ts (auto-capture on logger.error) and by application code
 * that needs explicit context tagging.
 */

import * as Sentry from "@sentry/nextjs";

import { env } from "@/lib/env";

function isEnabled(): boolean {
  return !!(env.SENTRY_DSN && env.SENTRY_DSN.length > 0);
}

export function captureError(
  err: unknown,
  context?: Record<string, unknown>,
): void {
  if (!isEnabled()) return;
  Sentry.captureException(err, { extra: context });
}

export function captureMessage(
  msg: string,
  context?: Record<string, unknown>,
): void {
  if (!isEnabled()) return;
  Sentry.captureMessage(msg, { extra: context });
}


