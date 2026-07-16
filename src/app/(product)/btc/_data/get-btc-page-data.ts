// src/app/(product)/btc/_data/get-btc-page-data.ts
//
// Composes the investor-ui data source's `BtcViewModel` (reserve/performance)
// with the page-scoped EXTRA blocks (attribution/production/custody/events/
// proofs/experts — see btc-page-types.ts) into one `BtcPageViewModel` the
// page renders.
//
// DEFAULT PATH: both halves are read from hearst-connect-backend
// (BackendInvestorUiDataSource) — no fixture, no Prisma, no local repository.
// A backend failure is NOT caught here: it propagates to the page, which
// renders an honest unavailable state (see page.tsx).
//
// PREVIEW PATH: `?state=` switches to FixtureInvestorUiDataSource + the local
// fixtures below — explicitly for QA, never the production default. Every
// fixture value carries status "FIXTURE" (see fixture-data-source.ts) so it
// can never be mistaken for LIVE in the UI.

import { getInvestorUiDataSource, getFixtureInvestorUiDataSource, BackendInvestorUiDataSource } from "@/features/investor-ui/data-source";
import type { BtcViewModel } from "@/features/investor-ui/types/btc";
import type { BtcPageExtraViewModel } from "./btc-page-types";
import { mapBtcExtra } from "./btc-page-mapper";
import {
  btcPageExtraCompleteFixture,
  btcPageExtraNotConfiguredFixture,
  btcPageExtraPartialFixture,
  btcPageExtraStaleFixture,
} from "./btc-page-fixtures";

export type BtcPageState = "complete" | "not-configured" | "stale" | "partial";

export interface BtcPageViewModel extends BtcViewModel {
  readonly extra: BtcPageExtraViewModel;
}

function resolvePreviewState(previewState?: string | null): BtcPageState | null {
  switch (previewState) {
    case "btc-not-configured":
    case "not-configured":
      return "not-configured";
    case "btc-stale":
    case "stale":
      return "stale";
    case "btc-partial":
    case "partial":
      return "partial";
    case "btc-complete":
    case "complete":
      return "complete";
    default:
      return null; // no explicit preview requested → use the real backend
  }
}

const EXTRA_FIXTURE_BY_STATE: Record<BtcPageState, BtcPageExtraViewModel> = {
  complete: btcPageExtraCompleteFixture,
  "not-configured": btcPageExtraNotConfiguredFixture,
  stale: btcPageExtraStaleFixture,
  partial: btcPageExtraPartialFixture,
};

/** Server-side loader — call from the /btc Server Component only. */
export async function getBtcPageData(previewState?: string | null): Promise<BtcPageViewModel> {
  const state = resolvePreviewState(previewState);

  if (state !== null) {
    // Explicit QA preview — fixtures only, never the production default.
    const dataSource = getFixtureInvestorUiDataSource({
      btc: state === "not-configured" ? "not-configured" : "complete",
    });
    const base = await dataSource.getBtc();
    return { ...base, extra: EXTRA_FIXTURE_BY_STATE[state] };
  }

  // Default path — real backend, no fixture, no fallback.
  const dataSource = getInvestorUiDataSource();
  const base = await dataSource.getBtc();
  const extra =
    dataSource instanceof BackendInvestorUiDataSource
      ? mapBtcExtra(await dataSource.getBtcExtra())
      : btcPageExtraNotConfiguredFixture; // unreachable in practice (factory always returns Backend today) — kept exhaustive, not a silent live fallback

  return { ...base, extra };
}
