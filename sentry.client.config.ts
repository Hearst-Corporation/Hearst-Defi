import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // Prod-only: keeps dev events out of the Sentry project and silences the
  // CSP-blocked ingest errors in the local console.
  enabled:
    process.env.NODE_ENV === "production" &&
    !!process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  // Error reporting only — Session Replay is disabled: its blob: worker is not
  // allowed by the app CSP and error capture does not need it.
  beforeSend(event) {
    // Filter non-actionable client-side noise
    if (event.exception) {
      const values = event.exception.values ?? [];
      for (const ex of values) {
        const msg = ex.value ?? "";
        if (
          msg.includes("NetworkError") ||
          msg.includes("Failed to fetch") ||
          msg.includes("Load failed") ||
          msg.includes("ResizeObserver loop")
        ) {
          return null;
        }
      }
    }
    return event;
  },
});
