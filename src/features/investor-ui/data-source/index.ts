// src/features/investor-ui/data-source/index.ts
//
// Barrel + factory. Screens should import `getInvestorUiDataSource` (or, for
// `?state=` QA previews, `getFixtureInvestorUiDataSource` directly) from
// here — never reach into `fixture-data-source.ts` / `gpu1-data-source.ts`
// individually in page code, so the choice of implementation stays a single
// documented switch.

import { FixtureInvestorUiDataSource } from "./fixture-data-source";
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
export { Gpu1InvestorUiDataSource } from "./gpu1-data-source";

/**
 * The single factory every screen should call. Explicit, no silent fallback:
 * returns `FixtureInvestorUiDataSource` today because GPU1's investor-UI
 * endpoints are not wired (see `gpu1-data-source.ts` header). Flip this to
 * `Gpu1InvestorUiDataSource` (or a feature-flagged branch between the two)
 * once a real endpoint exists for at least one screen — do that switch HERE,
 * not by scattering `new Fixture...()` across page components.
 */
export function getInvestorUiDataSource(): InvestorUiDataSource {
  return new FixtureInvestorUiDataSource();
}
