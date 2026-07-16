// src/features/investor-ui/data-source/gpu1-data-source.ts
//
// PREPARED, NOT ACTIVE. This class is the future adapter onto GPU1's
// investor-UI-shaped endpoints — it exists so the shape of the seam is
// visible ahead of the backend being ready, but `getInvestorUiDataSource()`
// (see `./index.ts`) does NOT return this class today; it always returns
// `FixtureInvestorUiDataSource` until a GPU1 endpoint for each screen exists
// and is explicitly flipped on.
//
// How this will wire up later (documented, not implemented):
//   - Follows the exact pattern of `src/lib/gpu1-client/dashboard.ts`:
//       import { gpu1Fetch } from "@/lib/gpu1-client/client";
//       export function getDashboard() {
//         return gpu1Fetch<DashboardDTO>("/api/v1/dashboard");
//       }
//     i.e. one `gpu1Fetch<T>(path)` call per screen, hitting a GPU1
//     `/api/v1/investor-ui/*` route (routes TBD — none exist yet).
//   - The GPU1 DTO (gpu1-backend/src/domain — `Resolved<T>` wrapper) would be
//     mapped here into this feature's `ResolvedViewModel<T>` shape (they are
//     structurally close but not identical: GPU1's `Resolved<T>` always
//     carries `provenance`/`freshness` as structured objects, this feature's
//     `ResolvedViewModel<T>` flattens them to display-ready strings — the
//     mapping belongs in this file, never inlined in a page).
//   - `isGPU1Error` (`@/lib/gpu1-client/errors`) would be caught here and
//     translated to a `status: "ERROR"` block — GPU1 failures must never
//     silently fall back to a fixture (no silent fallback, per the brief).
//
// No network call is made by this class today — every method throws.

import type { InvestorUiDataSource } from "./investor-ui-data-source";
import type { BtcViewModel } from "../types/btc";
import type { DashboardViewModel } from "../types/dashboard";
import type { MiningViewModel } from "../types/mining";
import type { ProfileViewModel } from "../types/profile";
import type { AiExpertResolvedViewModel } from "../types/ai-expert";

const NOT_WIRED_MESSAGE =
  "Gpu1InvestorUiDataSource is not yet wired — GPU1's public investor-UI API is blocked (see docs/*_CONTEXT.md, connect-api edge 502). Use FixtureInvestorUiDataSource until a real endpoint exists.";

export class Gpu1InvestorUiDataSource implements InvestorUiDataSource {
  async getDashboard(): Promise<DashboardViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }

  async getBtc(): Promise<BtcViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }

  async getMining(): Promise<MiningViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }

  async getProfile(): Promise<ProfileViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }

  async getAiExperts(): Promise<AiExpertResolvedViewModel> {
    throw new Error(NOT_WIRED_MESSAGE);
  }
}
