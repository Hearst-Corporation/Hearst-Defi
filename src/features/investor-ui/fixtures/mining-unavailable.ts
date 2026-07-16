// src/features/investor-ui/fixtures/mining-unavailable.ts
//
// Unavailable fixture — the honest default until PermissionedDynaVault v2.1
// is deployed and the keeper engine is indexed. Both blocks resolve to
// NOT_CONFIGURED with a null value — never a fabricated number.

import { fixtureUnresolved, FIXTURE_GENERATED_AT } from "./factories";
import type { MiningViewModel } from "../types/mining";

export const miningUnavailableFixture: MiningViewModel = {
  generatedAt: FIXTURE_GENERATED_AT,
  mining: fixtureUnresolved("NOT_CONFIGURED", {
    freshness: "not configured — v2.1 not deployed",
    error: {
      code: "contract_not_deployed",
      message: "PermissionedDynaVault v2.1 address is not configured yet.",
    },
  }),
  electricity: fixtureUnresolved("NOT_CONFIGURED", {
    freshness: "not configured — v2.1 not deployed",
    error: {
      code: "contract_not_deployed",
      message: "PermissionedDynaVault v2.1 address is not configured yet.",
    },
  }),
};
