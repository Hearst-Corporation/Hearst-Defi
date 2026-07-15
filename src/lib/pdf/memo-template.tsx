import { Document } from "@react-pdf/renderer";

import type { MemoPdfData } from "./memo-data";
import { AllocationBreakdownPage } from "./memo-pages/allocation-breakdown";
import { CoverPage } from "./memo-pages/cover";
import { DisclaimerPage } from "./memo-pages/disclaimer";
import { ExecutiveSummaryPage } from "./memo-pages/executive-summary";
import { MiningHealthPage } from "./memo-pages/mining-health";
import { PerformanceOverviewPage } from "./memo-pages/performance-overview";
import { RiskFrameworkPage } from "./memo-pages/risk-framework";

const TOTAL_PAGES = 7;

/**
 * Master Investor Memo document.
 *
 * Seven A4 portrait pages, light theme, brand-green accent used sparingly.
 * Driven from the live vault snapshot + coverage view plus the optional
 * Opus-generated `InvestorMemoOutput` (prose for executive bullets, disclaimer,
 * methodology note).
 *
 * The BTC-tactical page was removed with the scenario-engine retirement: its
 * only data source was the dead 4-sleeve `scenario.btc_tactical` block, so
 * rather than render an empty or invented page it is dropped entirely.
 */
export function MemoDocument({ data }: { data: MemoPdfData }) {
  return (
    <Document
      title={`Hearst Yield Vault — Investor Memo — ${data.period}`}
      author="Hearst Connect"
      subject="Hearst Yield Vault Monthly Investor Memo"
      keywords="Hearst Connect, investor memo, mining-backed note, BTC accumulation, Cayman SPV"
    >
      <CoverPage data={data} />
      <ExecutiveSummaryPage data={data} pageNumber={2} totalPages={TOTAL_PAGES} />
      <PerformanceOverviewPage
        data={data}
        pageNumber={3}
        totalPages={TOTAL_PAGES}
      />
      <MiningHealthPage data={data} pageNumber={4} totalPages={TOTAL_PAGES} />
      <RiskFrameworkPage data={data} pageNumber={5} totalPages={TOTAL_PAGES} />
      <AllocationBreakdownPage
        data={data}
        pageNumber={6}
        totalPages={TOTAL_PAGES}
      />
      <DisclaimerPage data={data} pageNumber={7} totalPages={TOTAL_PAGES} />
    </Document>
  );
}
