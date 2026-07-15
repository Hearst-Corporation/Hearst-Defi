import { Page, Text, View } from "@react-pdf/renderer";

import {
  Commentary,
  EyebrowTitle,
  KpiCell,
  PageFooter,
  PageHeader,
  StatusPill,
  type PillTone,
} from "../memo-components";
import { type MemoPdfData } from "../memo-data";
import { styles } from "../memo-styles";
import { FACTSHEET_DISCLAIMER } from "@/lib/products/dynavault-factsheet";

function marginTone(score: number): PillTone {
  if (score >= 65) return "success";
  if (score >= 45) return "warning";
  return "danger";
}

/**
 * Assumptions in force on the mining page, sourced ONLY from real data posture
 * — the operational feed is still a paper/placeholder feed pending the real
 * fleet integration (RP-10 / T-14), and the margin score is the engine-derived
 * composite. No frozen 4-sleeve scenario number is invented; the closing line
 * is the repo's canonical not-guaranteed disclaimer.
 */
const MINING_ASSUMPTIONS: readonly string[] = [
  "Hashrate and uptime are placeholder values pending the real fleet feed (RP-10); they are badged estimated, never attested.",
  "Margin score is the engine-derived composite of hashprice, energy cost and uptime; it is an estimate, not a measured value.",
  "On-chain attestation is pending Phase 2 (EventLogger on Base Sepolia); until then attestation is paper-based.",
  FACTSHEET_DISCLAIMER,
];

export function MiningHealthPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  // Scenario engine retired: the margin score comes straight from the mining
  // ops loader (`MiningMetric` + Proof), badged `estimated` — the only honest
  // source now that the 4-sleeve scenario is gone. No frozen scenario number
  // is surfaced.
  const marginScore = data.miningOps.margin_score;
  const hashrateDeployed = `${data.miningOps.hashrate_ph_s.toFixed(0)} PH/s`;
  const uptime = `${data.miningOps.uptime_pct.toFixed(1)}%`;
  const attestationsCount = data.miningOps.attestations_count;
  // Hashrate/uptime are read from `MiningMetric.deployedHashrate`/`uptimePct`,
  // both still hardcoded placeholders written by the hourly cron
  // (`market-data-hourly.ts`, RP-10) regardless of `is_fallback` — that flag
  // only signals "no DB rows yet", not "this row is a real measurement".
  // Never badge them `attested` until a real fleet feed lands (T-14).
  const opsProvenance = "estimated";
  const opsHint = data.miningOps.is_fallback
    ? "Fallback estimate — no operator rows yet"
    : "Placeholder pending real fleet feed (RP-10)";
  const uptimeHint = data.miningOps.is_fallback
    ? "Fallback estimate — no operator rows yet"
    : "Placeholder pending real uptime feed (RP-10)";

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={data.period} />

      <EyebrowTitle
        eyebrow="03 / Mining health"
        title="Operator margin & uptime"
      />

      <View style={styles.twoColGrid}>
        <KpiCell
          label="Hashrate deployed"
          value={hashrateDeployed}
          hint={opsHint}
          provenance={opsProvenance}
        />
        <KpiCell
          label="Margin score"
          value={`${marginScore} / 100`}
          hint="Engine-derived; lower triggers R2"
          // Engine composite — estimated.
          provenance="estimated"
        />
        <KpiCell
          label="Uptime"
          value={uptime}
          hint={uptimeHint}
          provenance={opsProvenance}
        />
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginTop: 14 }}>
        <StatusPill
          label={`Margin ${marginScore >= 65 ? "Healthy" : marginScore >= 45 ? "Compressed" : "Stressed"}`}
          tone={marginTone(marginScore)}
        />
        <StatusPill
          label={`Attestations ${attestationsCount}`}
          tone={attestationsCount > 0 ? "success" : "warning"}
        />
        <StatusPill label="On-chain proof: pending Phase 2" tone="neutral" />
      </View>

      <Text style={styles.h2}>Assumptions in force</Text>
      <View style={{ gap: 4 }}>
        {/*
          Static, honest assumptions — the 4-sleeve scenario engine that used to
          feed this list is retired, so nothing here is a frozen projection.
          The closing entry is the canonical not-guaranteed disclaimer; it must
          never be dropped from an opposable document.
        */}
        {MINING_ASSUMPTIONS.map((a, idx) => (
          <Text key={idx} style={styles.bodySmall}>
            &middot; {a}
          </Text>
        ))}
      </View>

      <Text style={styles.h2}>Operator commentary</Text>
      <Commentary>
        Mining margin score is the engine-derived composite of hashprice, energy
        cost and uptime. It drives the R2 rebalancing rule when it crosses the
        configured threshold. During the period under review, margin stayed
        within the band that keeps the Mining Power pocket productive as the
        note's primary BTC-accumulation engine, funded by the Reserve USDC
        pocket's electricity account. On-chain attestation will replace the
        current paper attestation in Phase 2 once the EventLogger contract is
        live on Base Sepolia.
      </Commentary>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
