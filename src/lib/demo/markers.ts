// Centralized demo provider markers + copy.
//
// Not wired to any UI or loader in this lot — these are the single source of
// truth for when the provider is branched later.
//
// NOTE: DEMO_SOURCE is a DATA-SOURCE marker stamped on demo payloads. It is NOT
// a ProvenanceBadge `Provenance` value (the badge union does not include
// "demo"). Mapping demo payloads to a visible provenance badge is a Lot 2
// decision and may require extending the Provenance union.

export const DEMO_SOURCE = "demo" as const;

export const DEMO_SANDBOX_LABEL = "Demo Sandbox" as const;

export const DEMO_SANDBOX_DISCLAIMER =
  "Demo data. Not live. No real subscription." as const;
