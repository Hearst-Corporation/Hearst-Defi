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

function marginTone(score: number): PillTone {
  if (score >= 65) return "success";
  if (score >= 45) return "warning";
  return "danger";
}

export function MiningHealthPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  // Source the mining margin score from the base scenario (mode=balanced)
  // when available; fall back to the first scenario.
  const baseScenario =
    data.input.scenarios.find((s) => s.mode === data.input.vault.mode) ??
    data.input.scenarios[0];

  // Operational numbers are sourced from `data.miningOps` (MiningMetric +
  // Proof loader). The margin score still comes from the active scenario so
  // it stays in lock-step with the engine output reported elsewhere in the
  // memo; if the scenario has none we fall back to the loader's margin.
  const marginScore =
    baseScenario?.mining_margin_score ?? data.miningOps.margin_score;
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
        {(baseScenario?.assumptions ?? []).slice(0, 4).map((a, idx) => (
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
