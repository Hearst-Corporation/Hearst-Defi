// src/features/investor-ui/data-source/investor-ui-data-source.ts
//
// The single data-source seam every Investor UI V2 screen reads through.
// A Server Component calls `getInvestorUiDataSource()` (the factory in
// `./index.ts`) and never imports Fixture/GPU1 implementations directly —
// that keeps the screen agnostic to which source is wired today.
//
// NOTE: `dashboard-data-source.ts` and `types.ts` in this same folder are
// page-scoped stubs A2/A4 wrote ahead of this file landing (Dashboard's
// `DashboardDataSource`, a `getProfile`-only `types.ts`). Both already use
// method names that match this interface 1:1 — folding them into
// `FixtureInvestorUiDataSource` below is a pure rename, not a redesign, and
// is safe to do in a follow-up pass without touching any page.

import type { BtcViewModel } from "../types/btc";
import type { DashboardViewModel } from "../types/dashboard";
import type { MiningViewModel } from "../types/mining";
import type { ProfileViewModel } from "../types/profile";
import type { AiExpertResolvedViewModel } from "../types/ai-expert";

export interface InvestorUiDataSource {
  getDashboard(): Promise<DashboardViewModel>;
  getBtc(): Promise<BtcViewModel>;
  getMining(): Promise<MiningViewModel>;
  getProfile(): Promise<ProfileViewModel>;
  /** AI-experts advisory rail shared by the Dashboard sidebar today; kept on
   *  the main interface (not screen-scoped) since it is cross-cutting. */
  getAiExperts(): Promise<AiExpertResolvedViewModel>;
}
