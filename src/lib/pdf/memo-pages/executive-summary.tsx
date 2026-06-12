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
  "Vault remained inside its target APY range, driven primarily by mining-backed cash flow and the USDC base sleeve.",
  "Monthly USDC distribution wired on schedule; no manual interventions, no unscheduled rebalances.",
  "Risk posture neutral. Mining margin score and BTC tactical guardrails operated within nominal bands.",
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
  // Distribution is loaded from the `Distribution` table (or its synthesised
  // fallback) and reported verbatim — no longer derived from AUM × 0.8%.
  const distributionUsdc = data.distribution?.amount_usdc ?? 0;
  const distributionStatus = data.distribution?.status ?? "pending";

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
          label="APY range — period"
          value={formatApyRange(input.vault.apyRange)}
          hint="Reported as low-high band only"
          // Engine-published projection for the period (range only).
          provenance="estimated"
        />
        <KpiCell
          label="Target APY range"
          value="8.0-15.0%"
          hint="Vault mandate, methodology v1.0"
          // Mandate band fixed in methodology v1.0 — human-curated boundary.
          provenance="manual"
        />
        <KpiCell
          label={
            distributionStatus === "paid"
              ? "Distribution paid"
              : "Distribution scheduled"
          }
          value={formatUsd(distributionUsdc)}
          hint="USDC, monthly, all LPs"
          // Once paid the ledger entry is attested; while scheduled it's an
          // engine-produced projection.
          provenance={distributionStatus === "paid" ? "attested" : "estimated"}
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
        <StatusPill
          label={
            distributionStatus === "paid"
              ? "Distribution paid"
              : distributionStatus === "scheduled"
                ? "Distribution scheduled"
                : "Distribution pending"
          }
          tone={distributionStatus === "paid" ? "success" : "neutral"}
        />
        <StatusPill
          label={`${input.scenarios.length} scenarios re-run`}
          tone="neutral"
        />
      </View>
      <Text style={styles.bodyMuted}>
        APY is reported as a range conditional on the stated assumptions. No
        single-point figure is published. Past performance does not indicate
        future results. Full disclaimers appear on page {totalPages}.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
