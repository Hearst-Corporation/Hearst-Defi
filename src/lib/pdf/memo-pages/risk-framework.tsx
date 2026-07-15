import { Page, Text, View } from "@react-pdf/renderer";

import {
  EyebrowTitle,
  KpiCell,
  PageFooter,
  PageHeader,
  StatusPill,
  type PillTone,
} from "../memo-components";
import { type MemoPdfData } from "../memo-data";
import { COLORS, styles } from "../memo-styles";

interface RiskRow {
  id: string;
  name: string;
  status: string;
  tone: PillTone;
  detail: string;
}

function buildRisks(riskScore: number): RiskRow[] {
  // Derive a coarse status from the composite risk score; the per-risk
  // breakdown is not yet in InvestorMemoInput. Documented in the report.
  const overall: PillTone =
    riskScore < 35 ? "success" : riskScore < 55 ? "warning" : "danger";

  return [
    {
      id: "smart_contract",
      name: "Smart contract",
      status: "Phase 1 paper",
      tone: "neutral",
      detail:
        "Testnet EventLogger live in Phase 2 on Base Sepolia. PermissionedDynaVault v2.1 (ERC-4626 core) is written and tested on Base Sepolia; mainnet deployment is gated on a completed Spearbit audit and remediation.",
    },
    {
      id: "mining_operations",
      name: "Mining operations",
      status: "Within band",
      tone: overall,
      detail:
        "Operator JV with margin score above the R2 threshold. Hashprice and energy exposure capped by the pocket allocation band.",
    },
    {
      id: "counterparty",
      name: "Counterparty",
      status: "Diversified",
      tone: "success",
      detail:
        "Custody, the Reserve USDC pocket, and mining-operator venues split across three counterparties; no single venue exceeds the 40% concentration cap.",
    },
    {
      id: "market",
      name: "Market",
      status: "Range-bound",
      tone: overall,
      detail:
        "The BTC Pouch is sized inside its volatility guardrail. Allocation re-runs across five scenarios are reported on the allocation page.",
    },
    {
      id: "regulatory",
      name: "Regulatory",
      status: "Cayman SPV",
      tone: "neutral",
      detail:
        "Cayman Exempted LP, accredited / professional investors only. Jurisdictional restrictions enforced at subscription; not an offer where prohibited.",
    },
  ];
}

export function RiskFrameworkPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  const risks = buildRisks(data.input.vault.riskScore);
  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={data.period} />

      <EyebrowTitle
        eyebrow="05 / Risk framework"
        title="Five canonical risk dimensions"
      />

      <View style={styles.twoColGrid}>
        <KpiCell
          label="Composite risk score"
          value={`${data.input.vault.riskScore} / 100`}
          hint="Lower is safer; methodology v3.0"
          // Engine composite under methodology v3.0.
          provenance="estimated"
        />
        <KpiCell
          label="Risks tracked"
          value={`${risks.length}`}
          hint="Canonical Hearst taxonomy"
          // Taxonomy is curated, count is deterministic.
          provenance="manual"
        />
        <KpiCell
          label="Methodology"
          value="v3.0"
          hint="Immutable; bump on change"
          // Methodology version is curated and immutable per release.
          provenance="manual"
        />
      </View>

      <Text style={styles.h2}>Per-risk posture</Text>
      <View style={styles.table}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, { flex: 1.4 }]}>Dimension</Text>
          <Text style={[styles.tableHeaderCell, { flex: 1.2 }]}>Status</Text>
          <Text style={[styles.tableHeaderCell, { flex: 3.4 }]}>
            Period posture
          </Text>
        </View>
        {risks.map((r, idx) => (
          <View
            key={r.id}
            style={[
              styles.tableRow,
              idx % 2 === 1 ? styles.tableRowAlt : {},
              idx === risks.length - 1 ? styles.tableRowLast : {},
              { alignItems: "flex-start" },
            ]}
          >
            <Text
              style={[styles.tableCell, { flex: 1.4, fontFamily: "Helvetica-Bold" }]}
            >
              {r.name}
            </Text>
            <View style={{ flex: 1.2 }}>
              <StatusPill label={r.status} tone={r.tone} />
            </View>
            <Text style={[styles.tableCell, { flex: 3.4, color: COLORS.textMuted }]}>
              {r.detail}
            </Text>
          </View>
        ))}
      </View>

      <Text style={[styles.bodySmall, { marginTop: 14 }]}>
        The composite risk score weights each dimension under methodology
        v3.0. It is a backward-looking and forward-looking blend; outcomes are
        not guaranteed. A breach in any dimension triggers an explicit
        rebalancing rule (R1-R8); none were triggered outside the published
        ruleset during the period.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
