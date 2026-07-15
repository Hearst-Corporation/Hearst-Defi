import { Page, Text, View } from "@react-pdf/renderer";

import { PdfProvenance } from "../components/pdf-provenance";
import {
  Commentary,
  EyebrowTitle,
  PageFooter,
  PageHeader,
} from "../memo-components";
import { type MemoPdfData, formatPct, formatUsd } from "../memo-data";
import { COLORS, styles } from "../memo-styles";

interface PerfRow {
  month: string;
  returnBand: string;
  navUsdc: number;
}

function buildRows(data: MemoPdfData): PerfRow[] {
  // Source of truth for the 4-month look-back is `data.monthlyHistory`
  // (VaultSnapshot ⊕ the loader's deterministic padding). We surface the
  // estimated return band (a range, non-negotiable #1) and NAV — the marked
  // value of the three pockets — and no longer a periodic cash distribution.
  const history = data.monthlyHistory;
  if (history.length === 0) {
    return [
      {
        month: data.period,
        returnBand: "9.4-12.8%",
        navUsdc: data.input.vault.aumUsdc,
      },
    ];
  }
  return history.map((row) => ({
    month: row.period,
    returnBand: `${row.apy_low.toFixed(1)}-${row.apy_high.toFixed(1)}%`,
    navUsdc: row.nav_usdc,
  }));
}

export function PerformanceOverviewPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  const rows = buildRows(data);
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={data.period} />

      <EyebrowTitle
        eyebrow="02 / Performance overview"
        title="Trailing 4-month progress"
      />

      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 1.6 }]}>Month</Text>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>
            Est. return band
          </Text>
          <Text
            style={[styles.tableHeaderCell, { flex: 1.8, textAlign: "right" }]}
          >
            NAV
          </Text>
          <Text
            style={[styles.tableHeaderCell, { flex: 1.1, textAlign: "right" }]}
          >
            Source
          </Text>
        </View>
        {rows.map((r, idx) => (
          <View
            key={r.month}
            style={[
              styles.tableRow,
              idx % 2 === 1 ? styles.tableRowAlt : {},
              idx === rows.length - 1 ? styles.tableRowLast : {},
            ]}
          >
            <Text style={[styles.tableCell, { flex: 1.6 }]}>{r.month}</Text>
            <Text style={[styles.tableCell, { flex: 2 }]}>{r.returnBand}</Text>
            <Text
              style={[styles.tableCell, { flex: 1.8, textAlign: "right" }]}
            >
              {formatUsd(r.navUsdc)}
            </Text>
            {/* Row blends an estimated return band + a live NAV snapshot -> partial. */}
            <View
              style={{
                flex: 1.1,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <PdfProvenance kind="partial" />
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.bodySmall, { marginTop: 8, color: COLORS.textDim }]}>
        NAV is the end-of-period marked value of the three pockets. The estimated
        target return is a range in accumulated BTC over the term, conditional on
        the stated assumptions; it is not a distributed cash yield and is not
        guaranteed.
      </Text>

      <Text style={styles.h2}>Backtest cross-check</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 2 }]}>Window</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.3, textAlign: "right" }]}>
            Total return
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.3, textAlign: "right" }]}>
            Max drawdown
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2, textAlign: "right" }]}>
            Worst month
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 0.9, textAlign: "right" }]}>
            Rebals
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
            Source
          </Text>
        </View>
        {data.input.backtests.map((bt, idx) => (
          <View
            key={bt.key}
            style={[
              styles.tableRow,
              idx % 2 === 1 ? styles.tableRowAlt : {},
              idx === data.input.backtests.length - 1 ? styles.tableRowLast : {},
            ]}
          >
            <Text style={[styles.tableCell, { flex: 2 }]}>
              {bt.key.replace(/_/g, " ")} &middot; {bt.startDate} to {bt.endDate}
            </Text>
            <Text style={[styles.tableCell, { flex: 1.3, textAlign: "right" }]}>
              {formatPct(bt.totalReturnPct)}
            </Text>
            <Text
              style={[
                styles.tableCell,
                { flex: 1.3, textAlign: "right", color: COLORS.danger },
              ]}
            >
              {formatPct(bt.maxDrawdownPct)}
            </Text>
            <Text style={[styles.tableCell, { flex: 1.2, textAlign: "right" }]}>
              {formatPct(bt.worstMonthPct)}
            </Text>
            <Text style={[styles.tableCell, { flex: 0.9, textAlign: "right" }]}>
              {bt.numRebalances}
            </Text>
            {/* Backtests are pure-engine simulations on historical windows. */}
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <PdfProvenance kind="estimated" />
            </View>
          </View>
        ))}
      </View>

      <Commentary>
        The note accumulates BTC over its 24-month term with rule-based
        take-profit; there is no periodic cash distribution. NAV tracks the
        marked value of the three pockets across the period. Backtests across
        bear, halving, and mining-crunch windows are simulations of the same
        rule set on historical data, not forecasts.
      </Commentary>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
