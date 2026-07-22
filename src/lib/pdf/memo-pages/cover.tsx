import { Page, Text, View } from "@react-pdf/renderer";

import { PdfProvenance } from "../components/pdf-provenance";
import {
  type MemoPdfData,
  formatApyRange,
  formatUsd,
  provenanceTagToPdfKind,
} from "../memo-data";
import { COLORS, styles } from "../memo-styles";

export function CoverPage({ data }: { data: MemoPdfData }) {
  const { input, period, generatedAt } = data;
  const dateLabel = new Date(generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    timeZone: "UTC",
  });
  return (
    <Page size="A4" style={styles.coverPage}>
      <View style={styles.coverTop}>
        <View>
          <Text style={styles.coverWordmark}>
            HEARST <Text style={styles.coverWordmarkAccent}>CONNECT</Text>
          </Text>
        </View>
        <View style={styles.coverBrandDot} />
      </View>

      <View style={styles.coverRule} />

      <Text style={styles.coverTitle}>
        Hearst Bitcoin Reserve Vault — Series 1{"\n"}Monthly Investor Memo
      </Text>
      <Text style={styles.coverSubtitle}>
        Mining-backed note. BTC accumulated over a 24-month term with rule-based
        take-profit; no periodic cash distribution. Cayman SPV, $250k minimum,
        60-day soft lock-up (contractual). Methodology v3.0.
      </Text>

      <View style={styles.coverKpiGrid}>
        <View style={styles.coverKpi}>
          <Text style={styles.coverKpiLabel}>Period</Text>
          <Text style={styles.coverKpiValue}>{period}</Text>
          <Text style={styles.coverKpiHint}>Generated {dateLabel} UTC</Text>
          {/* Period label is set by the report scheduler — manual curation. */}
          <View style={{ marginTop: 6 }}>
            <PdfProvenance kind="manual" />
          </View>
        </View>
        <View style={styles.coverKpi}>
          <Text style={styles.coverKpiLabel}>Est. target return</Text>
          <Text style={styles.coverKpiValue}>
            {formatApyRange(input.vault.apyRange)}
          </Text>
          <Text style={styles.coverKpiHint}>
            Range in accumulated BTC &middot; not distributed, not guaranteed
          </Text>
          {/*
            Headline band is the vault's own engine preset (`def.apyTarget` in
            loaders/vault.ts) — a human-curated mandate constant, not a per-run
            model estimate. Badge it `manual`, never `estimated`.
          */}
          <View style={{ marginTop: 6 }}>
            <PdfProvenance kind="manual" />
          </View>
        </View>
        <View style={styles.coverKpi}>
          <Text style={styles.coverKpiLabel}>AUM</Text>
          <Text style={styles.coverKpiValue}>
            {formatUsd(input.vault.aumUsdc)}
          </Text>
          <Text style={styles.coverKpiHint}>USDC, end-of-period snapshot</Text>
          {/*
            AUM provenance is threaded from the loader (VaultSnapshot freshness
            + source authenticity): attested / estimated / stale — NEVER live,
            since a seeded/computed snapshot is not a real custody measurement.
          */}
          <View style={{ marginTop: 6 }}>
            <PdfProvenance
              kind={provenanceTagToPdfKind(input.provenance?.vault ?? "estimated")}
              hint="custody snapshot"
            />
          </View>
        </View>
        <View style={styles.coverKpi}>
          <Text style={styles.coverKpiLabel}>Risk score</Text>
          <Text style={styles.coverKpiValue}>{input.vault.riskScore} / 100</Text>
          <Text style={styles.coverKpiHint}>
            Composite, methodology v3.0 weighting
          </Text>
          {/* Composite — derived from sub-scores under methodology v3.0. */}
          <View style={{ marginTop: 6 }}>
            <PdfProvenance kind="estimated" />
          </View>
        </View>
      </View>

      <View style={styles.coverFooter}>
        <Text style={styles.coverFooterText}>
          CONFIDENTIAL &middot; ACCREDITED INVESTORS ONLY
        </Text>
        <Text style={[styles.coverFooterText, { color: COLORS.textDim }]}>
          HEARST CONNECT &middot; hearst-connect.com
        </Text>
      </View>
    </Page>
  );
}
