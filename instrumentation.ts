import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 16 loads this `register()` hook once per server runtime (Node + Edge).
 *
 * It is the ONLY way the Sentry server/edge SDK initializes under a Turbopack
 * build: the `@sentry/nextjs` webpack plugin that would otherwise inject the
 * init does NOT run under Turbopack, so without this file `sentry.server.config`
 * / `sentry.edge.config` are never imported and every server-side
 * `captureException` / `logger.error` forward is a silent no-op.
 *
 * Both configs guard on `SENTRY_DSN`, so this is inert in dev/local (no DSN) and
 * only arms in environments where the DSN is set. See product-integrity audit P0.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

/**
 * Forwards App Router server errors (RSC render, route handlers, server actions)
 * to Sentry. Next.js calls this automatically when it is exported from
 * `instrumentation.ts`; it is the server-side counterpart to the client error
 * boundary and closes the "platform looks monitored but is blind to server
 * errors" gap.
 */
export const onRequestError = Sentry.captureRequestError;
