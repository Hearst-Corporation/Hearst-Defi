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

const CHART_WIDTH = 460;
const CHART_HEIGHT = 28;

export function AllocationBreakdownPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  const baseScenario =
    data.input.scenarios.find((s) => s.mode === data.input.vault.mode) ??
    data.input.scenarios[0];

  const allocations = baseScenario?.allocations ?? [];
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
            {/* Current weight is engine-derived under the active vault mode. */}
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

      <Text style={[styles.bodySmall, { marginTop: 12 }]}>
        Weights reflect the current vault mode ({data.input.vault.mode}) and
        rebalance within their bands via rules R1-R8. Target bands: Mining Power
        40%, BTC Pouch 27%, Reserve USDC 33%. The note accumulates BTC over its
        24-month term with rule-based take-profit; there is no periodic cash
        distribution.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
