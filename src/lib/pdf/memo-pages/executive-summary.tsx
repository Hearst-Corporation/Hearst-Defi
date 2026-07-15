import { Page, Text, View } from "@react-pdf/renderer";

import {
  Bullet,
  EyebrowTitle,
  KpiCell,
  PageFooter,
  PageHeader,
  StatusPill,
} from "../memo-components";
import {
  type MemoPdfData,
  extractBullets,
  formatApyRange,
  formatUsd,
  stripMarkdown,
} from "../memo-data";
import { styles } from "../memo-styles";

const FALLBACK_BULLETS: string[] = [
  "Capital stayed structured across the three pockets — Mining Power (40%), BTC Pouch (27%), Reserve USDC (33%). The estimated target return is a range in accumulated BTC over the term, not a distributed cash yield.",
  "No periodic cash distribution: BTC accumulates over the 24-month term with rule-based take-profit. No manual interventions, no unscheduled rebalances.",
  "Risk posture neutral. Mining margin score and BTC Pouch guardrails operated within nominal bands.",
  "Five scenarios re-run on current vault state. Outputs presented as ranges, never single points.",
];

export function ExecutiveSummaryPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  const { input, memo, period } = data;
  const bullets = memo
    ? extractBullets(memo.executive_summary, 4).map(stripMarkdown)
    : FALLBACK_BULLETS;
  const safeBullets = bullets.length > 0 ? bullets : FALLBACK_BULLETS;

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={period} />

      <EyebrowTitle eyebrow="01 / Executive summary" title="Period in review" />

      <View style={styles.row}>
        <View style={[{ flex: 1, gap: 8 }]}>
          {safeBullets.map((b, idx) => (
            <Bullet key={idx}>{b}</Bullet>
          ))}
        </View>
      </View>

      <View style={[styles.twoColGrid, { marginTop: 18 }]}>
        <KpiCell
          label="Est. return — period"
          value={formatApyRange(input.vault.apyRange)}
          hint="Accumulated-BTC band, not distributed"
          // Engine-published projection for the period (range only).
          provenance="estimated"
        />
        <KpiCell
          label="Est. target return (term)"
          value="8.0-15.0%"
          hint="Mining-note mandate, not guaranteed"
          // Mandate band fixed in methodology v3.0 — human-curated boundary.
          provenance="manual"
        />
        <KpiCell
          label="Term"
          value="24 months"
          hint="BTC delivered at maturity"
          // Product term — a v2.1 product constant, human-curated.
          provenance="manual"
        />
      </View>

      <View style={[styles.twoColGrid, { marginTop: 10 }]}>
        <KpiCell
          label="AUM"
          value={formatUsd(input.vault.aumUsdc)}
          hint="End of period snapshot"
          // Custody snapshot at end of period — live.
          provenance="live"
        />
        <KpiCell
          label="Vault mode"
          value={input.vault.mode}
          hint="Engine-derived posture"
          // Mode is engine output (rule-based classifier).
          provenance="estimated"
        />
        <KpiCell
          label="Risk score"
          value={`${input.vault.riskScore} / 100`}
          hint="Composite, lower is safer"
          // Composite produced by the engine — estimated.
          provenance="estimated"
        />
      </View>

      <Text style={styles.h2}>Posture statement</Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 8 }}>
        <StatusPill label={`Mode ${input.vault.mode}`} tone="brand" />
        <StatusPill label="BTC accumulation" tone="neutral" />
        <StatusPill
          label={`${input.scenarios.length} scenarios re-run`}
          tone="neutral"
        />
      </View>
      <Text style={styles.bodyMuted}>
        The estimated target return is reported as a range conditional on the
        stated assumptions and expressed in accumulated BTC over the term — no
        single-point figure and no distributed cash yield is published. Past
        performance does not indicate future results. Full disclaimers appear on
        page {totalPages}.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
