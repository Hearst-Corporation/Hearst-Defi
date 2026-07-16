// src/features/investor-ui/data-source/index.ts
//
// Barrel + factory. Screens should import `getInvestorUiDataSource` (or, for
// `?state=` QA previews, `getFixtureInvestorUiDataSource` directly) from
// here — never reach into `fixture-data-source.ts` / `gpu1-data-source.ts`
// individually in page code, so the choice of implementation stays a single
// documented switch.

import { FixtureInvestorUiDataSource } from "./fixture-data-source";
import { BackendInvestorUiDataSource } from "./backend-data-source";
import type { InvestorUiDataSource } from "./investor-ui-data-source";

export type { InvestorUiDataSource } from "./investor-ui-data-source";
export {
  FixtureInvestorUiDataSource,
  getFixtureInvestorUiDataSource,
  type DashboardFixtureState,
  type BtcFixtureState,
  type MiningFixtureState,
  type ProfileFixtureState,
} from "./fixture-data-source";
export { BackendInvestorUiDataSource } from "./backend-data-source";

/**
 * The single factory every screen should call. Explicit, no silent fallback:
 * returns `BackendInvestorUiDataSource` by default — every business read
 * goes through hearst-connect-backend (independent repository) over HTTP.
 * `FixtureInvestorUiDataSource` is used ONLY for explicit `?state=` QA
 * previews (see each page's preview-state handling) — never as a silent
 * runtime fallback when the backend errors. Do this switch HERE, not by
 * scattering `new Backend...()` / `new Fixture...()` across page components.
 */
export function getInvestorUiDataSource(): InvestorUiDataSource {
  return new BackendInvestorUiDataSource();
}
