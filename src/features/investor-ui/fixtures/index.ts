// src/features/investor-ui/fixtures/index.ts
//
// Barrel re-export of every named fixture. Consumers should generally prefer
// importing the specific fixture file they need (keeps bundles/tests
// focused), but this barrel exists for quick exploration and for the
// architecture-guard / fixture tests that need to enumerate them all.

export * from "./factories";

export * from "./dashboard-complete";
export * from "./dashboard-partial";
export * from "./dashboard-unavailable";
export * from "./dashboard-not-configured";
export * from "./dashboard-no-position";
export * from "./dashboard-cap-full";
export * from "./dashboard-not-eligible";

export * from "./btc-complete";
export * from "./btc-not-configured";

export * from "./mining-complete";
export * from "./mining-stale";
export * from "./mining-unavailable";

export * from "./profile-complete";
export * from "./profile-incomplete";
