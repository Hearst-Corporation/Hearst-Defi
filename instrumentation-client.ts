// Next.js 16 / Turbopack loads this file for the browser runtime. It is the
// only thing that runs sentry.client.config's Sentry.init under Turbopack
// (the @sentry/nextjs webpack plugin that would auto-load it does NOT run
// under Turbopack, so without this file browser error capture, replayIntegration,
// and the beforeSend noise filter are all dead in prod).
//
// Importing sentry.client.config is sufficient — its Sentry.init call runs
// exactly once. There is no double-init risk because the webpack plugin that
// would otherwise inject the init does not run under Turbopack.
import "./sentry.client.config";

export { captureRouterTransitionStart as onRouterTransitionStart } from "@sentry/nextjs";
