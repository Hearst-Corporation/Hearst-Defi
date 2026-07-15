import { Page, Rect, Svg, Text, View } from "@react-pdf/renderer";

import { PdfProvenance } from "../components/pdf-provenance";
import {
  EyebrowTitle,
  PageFooter,
  PageHeader,
} from "../memo-components";
import { type MemoPdfData } from "../memo-data";
import {
  ALLOCATION_HINTS,
  ALLOCATION_LABELS,
  ALLOCATION_PALETTE,
  COLORS,
  styles,
} from "../memo-styles";
import {
  B1_MINING_ALLOCATION_BPS,
  B2_BTC_ALLOCATION_BPS,
  B3_USDC_ALLOCATION_BPS,
} from "@/lib/products/dynavault-factsheet";

const CHART_WIDTH = 460;
const CHART_HEIGHT = 28;

/**
 * Fixed on-chain allocation of PermissionedDynaVault v2.1 (the v3.0 factsheet):
 * B1 Mining 40% / B2 BTC 27% / B3 Reserve USDC 33%, derived from the bps
 * CONSTANTS (never from the retired 4-sleeve scenario). The `bucket` keys map
 * onto the existing `ALLOCATION_*` label/palette/hint tables. These are product
 * constants (provenance=manual), not chain reads — badged accordingly below.
 */
const FACTSHEET_ALLOCATIONS: ReadonlyArray<{ bucket: string; pct: number }> = [
  { bucket: "mining", pct: B1_MINING_ALLOCATION_BPS / 100 },
  { bucket: "btc_tactical", pct: B2_BTC_ALLOCATION_BPS / 100 },
  { bucket: "usdc_base", pct: B3_USDC_ALLOCATION_BPS / 100 },
];

export function AllocationBreakdownPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  // Allocations come from the v3.0 factsheet CONSTANTS (40/27/33), not from the
  // retired 4-sleeve scenario. The bar always sums to 100 by construction.
  const allocations = FACTSHEET_ALLOCATIONS;
  const totalPct = allocations.reduce((sum, a) => sum + a.pct, 0) || 100;

  // Pre-compute x offsets for the stacked bar using reduce to avoid mutation.
  const segments = allocations.reduce<
    Array<{
      bucket: string;
      pct: number;
      width: number;
      x: number;
      fill: string;
    }>
  >((acc, a) => {
    const width = (a.pct / totalPct) * CHART_WIDTH;
    const x = acc.reduce((sum, s) => sum + s.width, 0);
    return [
      ...acc,
      {
        bucket: a.bucket,
        pct: a.pct,
        width,
        x,
        fill: ALLOCATION_PALETTE[a.bucket] ?? COLORS.borderStrong,
      },
    ];
  }, []);

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={data.period} />

      <EyebrowTitle
        eyebrow="06 / Allocation breakdown"
        title="Three pockets"
      />

      <Text style={styles.bodyMuted}>
        Capital is structured into three pockets under PermissionedDynaVault
        v2.1, with target bands 40 / 27 / 33 (4000 / 2700 / 3300 bps). The bar
        below shows the current weight of each pocket; the note accumulates BTC
        over its term and pays no periodic cash distribution.
      </Text>

      <View style={{ marginTop: 14 }}>
        <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
          {segments.map((s) => (
            <Rect
              key={s.bucket}
              x={s.x}
              y={0}
              width={s.width}
              height={CHART_HEIGHT}
              fill={s.fill}
            />
          ))}
          <Rect
            x={0}
            y={0}
            width={CHART_WIDTH}
            height={CHART_HEIGHT}
            stroke={COLORS.borderStrong}
            strokeWidth={0.5}
            fill="transparent"
          />
        </Svg>
      </View>

      <View style={styles.allocationLegend}>
        {segments.map((s) => (
          <View key={s.bucket} style={styles.allocationLegendRow}>
            <View
              style={[styles.allocationSwatch, { backgroundColor: s.fill }]}
            />
            <Text style={styles.allocationLabel}>
              {ALLOCATION_LABELS[s.bucket] ?? s.bucket}
            </Text>
            <Text style={styles.allocationPct}>{s.pct.toFixed(0)}%</Text>
          </View>
        ))}
      </View>

      <Text style={styles.h2}>Pocket roles</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 1.8 }]}>Pocket</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
            Weight
          </Text>
          <Text style={[styles.tableHeaderCell, { flex: 3.2 }]}>Role</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1, textAlign: "right" }]}>
            Source
          </Text>
        </View>
        {segments.map((s, idx) => (
          <View
            key={s.bucket}
            style={[
              styles.tableRow,
              idx % 2 === 1 ? styles.tableRowAlt : {},
              idx === segments.length - 1 ? styles.tableRowLast : {},
              { alignItems: "flex-start" },
            ]}
          >
            <Text
              style={[
                styles.tableCell,
                { flex: 1.8, fontFamily: "Helvetica-Bold" },
              ]}
            >
              {ALLOCATION_LABELS[s.bucket] ?? s.bucket}
            </Text>
            <Text style={[styles.tableCell, { flex: 1, textAlign: "right" }]}>
              {s.pct.toFixed(0)}%
            </Text>
            <Text
              style={[styles.tableCell, { flex: 3.2, color: COLORS.textMuted }]}
            >
              {ALLOCATION_HINTS[s.bucket] ?? ""}
            </Text>
            {/*
              Weight is the fixed on-chain target from the v2.1 factsheet
              constants (product constant, not a chain read) — badge `manual`,
              never `estimated`/`live`.
            */}
            <View
              style={{
                flex: 1,
                flexDirection: "row",
                justifyContent: "flex-end",
              }}
            >
              <PdfProvenance kind="manual" />
            </View>
          </View>
        ))}
      </View>

      <Text style={[styles.bodySmall, { marginTop: 12 }]}>
        The allocation is fixed on-chain: Mining Power 40%, BTC Pouch 27%,
        Reserve USDC 33% (4000 / 2700 / 3300 bps). Outcomes are shaped by
        on-chain mechanisms — take-profit tiers, the Reserve USDC vending curve
        and mining curtailment — not by sleeve reallocation. The note
        accumulates BTC over its 24-month term with rule-based take-profit;
        there is no periodic cash distribution.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
