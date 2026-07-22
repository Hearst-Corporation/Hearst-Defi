// src/features/investor-ui/data-source/index.ts
//
// Barrel + factory. Screens import `getInvestorUiDataSource` from here so the
// choice of implementation stays a single documented switch.
//
// The fixture implementation is GONE (2026-07-22). `FixtureInvestorUiDataSource`
// and the 16 fixture files existed for `?state=` QA previews that no route
// ever wired up — a closed, dead import graph carrying realistic-looking
// figures ($250k deposits, full dashboards) whose only possible future was
// being reconnected by mistake. The purge removed the whole chain; the only
// data source is the backend one, which is also the only truth.

import { BackendInvestorUiDataSource } from "./backend-data-source";
import type { InvestorUiDataSource } from "./investor-ui-data-source";

export type { InvestorUiDataSource } from "./investor-ui-data-source";
export { BackendInvestorUiDataSource } from "./backend-data-source";

/**
 * The single factory every screen should call. Explicit, no silent fallback:
 * returns `BackendInvestorUiDataSource` — every business read goes through
 * hearst-connect-backend (independent repository) over HTTP. There is no
 * fixture implementation to fall back to, by construction.
 */
export function getInvestorUiDataSource(): InvestorUiDataSource {
  return new BackendInvestorUiDataSource();
}
