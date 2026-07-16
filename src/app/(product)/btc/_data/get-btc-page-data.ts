// src/app/(product)/btc/_data/get-btc-page-data.ts
//
// Composes A5's `BtcViewModel` (reserve/performance, via
// `FixtureInvestorUiDataSource`/`InvestorUiDataSource`) with the page-scoped
// EXTRA blocks (production/trajectory/ladder/custody/events/proofs/experts —
// see btc-page-types.ts) into one `BtcPageViewModel` the page renders.
//
// `?state=` query param drives BOTH halves together so the four preview
// variants (complete / not-configured / stale / partial) stay coherent — the
// same convention A4 used for /mining (`getMiningDataSource(previewState)`).
//
// No Prisma/Supabase/RPC access here — only the shared data-source seam +
// local fixtures.

import { FixtureInvestorUiDataSource } from "@/features/investor-ui/data-source/fixture-data-source";
import type { BtcViewModel } from "@/features/investor-ui/types/btc";
import type { BtcPageExtraViewModel } from "./btc-page-types";
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

function resolvePreviewState(previewState?: string | null): BtcPageState {
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
    default:
      return "complete";
  }
}

const EXTRA_BY_STATE: Record<BtcPageState, BtcPageExtraViewModel> = {
  complete: btcPageExtraCompleteFixture,
  "not-configured": btcPageExtraNotConfiguredFixture,
  stale: btcPageExtraStaleFixture,
  partial: btcPageExtraPartialFixture,
};

/** Server-side loader — call from the /btc Server Component only. */
export async function getBtcPageData(
  previewState?: string | null,
): Promise<BtcPageViewModel> {
  const state = resolvePreviewState(previewState);
  const dataSource = new FixtureInvestorUiDataSource({
    btc: state === "not-configured" ? "not-configured" : "complete",
  });
  const base = await dataSource.getBtc();

  return {
    ...base,
    extra: EXTRA_BY_STATE[state],
  };
}
