// src/features/investor-ui/components/states/index.ts
//
// Barrel for the shared per-block state renderers. `data-states.tsx` is the
// canonical implementation (originally stubbed by A2, already adopted by
// every screen — BTC/Mining/Dashboard/Profile — before this barrel landed),
// re-exported here so new code can also do
// `import { DataUnavailable } from "@/features/investor-ui/components/states"`.

export * from "./data-states";
