// /btc/ledger — the FULL Bitcoin register (P2.4 drill-down).
//
// Cockpit doctrine: the /btc surface is a 3-zone no-scroll board; drill-down
// lives on dedicated pages, never in slide-overs. This page is that
// drill-down — a NORMAL scrollable page (no dash-signature scope, no
// cockpit-fit) rendering the two components that were built for /btc but had
// no home since the cockpit pass: BtcLedgerTable (full register, month bands,
// running balance, tx hashes) + BtcMaturityPanel (delivery terms).
//
// Same data seams as /btc: getBtcPageData for the page-scoped blocks and the
// shared backend source for months elapsed. Explicit `?state=` previews remain
// fixture-backed and degrade coherently across both pages.
//
// Honesty contract unchanged: provenance from block statuses, "—" without an
// anchor, no fabricated balances (buildBtcLedgerRows only folds when the
// reserve provides a real closing figure).

import Link from "next/link";

import { BentoPageShell } from "@/components/catalyst/bento";
import { Heading } from "@/components/catalyst/heading";
import { requireInvestor } from "@/lib/auth/require-investor";
import {
  getFixtureInvestorUiDataSource,
  getInvestorUiDataSource,
} from "@/features/investor-ui/data-source";
import { PageErrorState } from "@/features/investor-ui/components/states/data-states";
import { isBackendError } from "@/lib/backend";
import { formatIsoDate, toProvenance } from "@/features/investor-ui/format-btc";

import { getBtcPageData } from "../_data/get-btc-page-data";
import { buildBtcLedgerRows } from "../_data/btc-ledger-rows";
import { BtcLedgerTable } from "../_components/btc-ledger-table";
import { BtcMaturityPanel } from "../_components/btc-maturity-panel";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Bitcoin ledger · Hearst Connect",
  description: "Full register of BTC movements and attestations, with maturity delivery terms",
};

const PREVIEW_STATES = new Set([
  "complete",
  "not-configured",
  "stale",
  "partial",
  "btc-complete",
  "btc-not-configured",
  "btc-stale",
  "btc-partial",
]);

export default async function BtcLedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  await requireInvestor("/btc/ledger");
  const { state } = await searchParams;

  let data;
  let mining;
  try {
    const sharedPreview =
      state != null && PREVIEW_STATES.has(state)
        ? state.replace(/^btc-/, "")
        : null;
    const miningSource = sharedPreview
      ? getFixtureInvestorUiDataSource({
          mining:
            sharedPreview === "complete" || sharedPreview === "stale"
              ? sharedPreview
              : "unavailable",
        })
      : getInvestorUiDataSource();
    [data, mining] = await Promise.all([
      getBtcPageData(state),
      miningSource.getMining(),
    ]);
  } catch (err) {
    // Backend down / network / 5xx / timeout — never a page crash, never a
    // fixture substitution. One honest page-level error, same shell/testId as
    // the healthy ledger page so the surface stays rendered.
    const detail = isBackendError(err)
      ? `hearst-connect-backend did not respond (${err.code}${err.status ? `, HTTP ${err.status}` : ""}).`
      : "The data source failed unexpectedly.";
    return (
      <BentoPageShell testId="btc-ledger-page">
        <PageErrorState title="Bitcoin ledger unavailable" detail={detail} />
      </BentoPageShell>
    );
  }

  const monthsElapsed = mining.mining.value?.currentMonth ?? null;
  const monthsTotal = mining.mining.value?.productDurationMonths ?? 24;

  // Running balance pre-computed HERE (view-model layer), anchored on the
  // vault reserve's closing balance — the table only formats.
  const rows = buildBtcLedgerRows(
    data.extra.events.value ?? [],
    data.reserve.value?.reserveBtcSats ?? null,
  );

  return (
    <BentoPageShell testId="btc-ledger-page">
      <div className="flex min-w-0 flex-col gap-[var(--ct-space-5)]">
        {/* Sober register header — back to the /btc cockpit board. */}
        <div className="flex flex-wrap items-end justify-between gap-[var(--ct-space-3)]">
          <div className="flex flex-col gap-[var(--ct-space-1)]">
            <Link href="/btc" className="body-xs ct-link-accent whitespace-nowrap self-start">
              <span aria-hidden="true">← </span>Back to Bitcoin
            </Link>
            <Heading level={1} className="ct-text-strong m-0">
              Bitcoin ledger
            </Heading>
            <p className="ct-metric-caption m-0">
              Full register of every movement that changed the BTC balance, with attestations and delivery terms.
            </p>
          </div>
        </div>

        <BtcLedgerTable
          events={rows}
          provenance={toProvenance(data.extra.events.status)}
          allAttestationsHref="/proof-center/full"
        />

        <BtcMaturityPanel
          monthsElapsed={monthsElapsed}
          monthsTotal={monthsTotal}
          custody={data.extra.custody.value}
          reserve={data.reserve.value}
          asOf={data.generatedAt}
          provenance={toProvenance(data.extra.custody.status)}
        />

        {/* Same honest freshness line as /btc. */}
        <p className="ct-metric-caption m-0 px-[var(--ct-space-1)]">
          Data as of {formatIsoDate(data.generatedAt)} — accumulated BTC is delivered at maturity, not guaranteed.
        </p>
      </div>
    </BentoPageShell>
  );
}
