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
import { type MemoPdfData, provenanceTagToPdfKind } from "../memo-data";
import { COLORS, styles } from "../memo-styles";

function triggerTone(kind: string, armed: boolean): PillTone {
  if (!armed) return "neutral";
  if (kind === "accumulate") return "brand";
  if (kind === "take_profit") return "success";
  if (kind === "reduce_size") return "warning";
  return "neutral";
}

function guardrailTone(status: string): PillTone {
  if (status === "breached") return "danger";
  if (status === "warning") return "warning";
  if (status === "healthy") return "success";
  return "neutral";
}

export function BtcTacticalPage({
  data,
  pageNumber,
  totalPages,
}: {
  data: MemoPdfData;
  pageNumber: number;
  totalPages: number;
}) {
  // Use BTC Pouch state from the mode-matched scenario.
  const baseScenario =
    data.input.scenarios.find((s) => s.mode === data.input.vault.mode) ??
    data.input.scenarios[0];
  const tactical = baseScenario?.btc_tactical;
  const targetPct = tactical?.targetExposurePct ?? 0;
  const triggers = tactical?.triggers ?? [];
  const guardrails = tactical?.guardrails ?? [];

  // Target exposure, armed-trigger count and guardrail count all come from the
  // SAME object — `baseScenario.btc_tactical`, a rehydrated engine artifact the
  // loader classes as `scenarios` (attested, deterministic). None of them is a
  // live feed; badge all three from `input.provenance.scenarios`, never `live`.
  const tacticalKind = provenanceTagToPdfKind(
    data.input.provenance?.scenarios ?? "attested",
  );

  return (
    <Page size="A4" style={styles.page}>
      <PageHeader period={data.period} />

      <EyebrowTitle
        eyebrow="04 / BTC Pouch"
        title="Exposure, triggers, guardrails"
      />

      <View style={styles.twoColGrid}>
        <KpiCell
          label="Target exposure"
          value={`${targetPct}%`}
          hint="of capital, rule-bound"
          // Engine-derived target tied to the active scenario artifact.
          provenance={tacticalKind}
        />
        <KpiCell
          label="Triggers armed"
          value={`${triggers.filter((t) => t.armed).length} / ${triggers.length}`}
          hint="PTAI framework only"
          // Armed-trigger count read off the rehydrated scenario artifact,
          // not a live feed — same provenance as the rest of the block.
          provenance={tacticalKind}
        />
        <KpiCell
          label="Guardrails"
          value={`${guardrails.length} active`}
          hint="Volatility, margin, concentration"
          // Guardrail set from the same scenario artifact — not a live feed.
          provenance={tacticalKind}
        />
      </View>

      {/*
        Active PTAI triggers — full 4-column layout (Projection / Trigger /
        Action / Impact) per CLAUDE.md non-negotiable #3. Kind + armed status
        sit in a header row above the 4 PTAI cells so the table reads as one
        compact block per trigger without losing the metadata.
        Fix: audit coherence-2026-05-26 / 08-ptai-format (P1.2).
      */}
      <Text style={styles.h2}>Active PTAI triggers</Text>
      <View style={{ gap: 6 }}>
        {triggers.length === 0 ? (
          <View
            style={{
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 4,
              paddingVertical: 8,
              paddingHorizontal: 10,
            }}
          >
            <Text style={styles.tableCellMuted}>
              No active triggers in the current vault state.
            </Text>
          </View>
        ) : (
          triggers.map((t) => {
            const projection = `Target BTC Pouch exposure ${targetPct}% of capital maintained while the trigger is ${t.armed ? "armed" : "idle"}.`;
            const impact = t.armed
              ? `Engine will execute "${t.action}" on the BTC Pouch to stay within target bands.`
              : "No allocation change while idle — guardrails remain the only active safeguard.";
            return (
              <View
                key={t.id}
                style={{
                  borderWidth: 1,
                  borderColor: COLORS.border,
                  borderRadius: 4,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  gap: 4,
                }}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={[styles.tableCell, { fontFamily: "Helvetica-Bold" }]}
                  >
                    {t.kind.replace(/_/g, " ")}
                  </Text>
                  <View style={{ marginLeft: "auto" }}>
                    <StatusPill
                      label={t.armed ? "armed" : "idle"}
                      tone={triggerTone(t.kind, t.armed)}
                    />
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      { flex: 0.8, paddingHorizontal: 0 },
                    ]}
                  >
                    Projection
                  </Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>
                    {projection}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      { flex: 0.8, paddingHorizontal: 0 },
                    ]}
                  >
                    Trigger
                  </Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>
                    {t.condition}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      { flex: 0.8, paddingHorizontal: 0 },
                    ]}
                  >
                    Action
                  </Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>
                    {t.action}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Text
                    style={[
                      styles.tableHeaderCell,
                      { flex: 0.8, paddingHorizontal: 0 },
                    ]}
                  >
                    Impact
                  </Text>
                  <Text style={[styles.tableCell, { flex: 3 }]}>{impact}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <Text style={styles.h2}>Guardrails</Text>
      <View style={{ gap: 6 }}>
        {guardrails.map((g) => (
          <View
            key={g.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderWidth: 1,
              borderColor: COLORS.border,
              borderRadius: 4,
            }}
          >
            <View style={{ flex: 1.5 }}>
              <Text
                style={[styles.tableCell, { fontFamily: "Helvetica-Bold" }]}
              >
                {g.label}
              </Text>
              <Text style={styles.bodySmall}>{g.detail}</Text>
            </View>
            <StatusPill label={g.status} tone={guardrailTone(g.status)} />
          </View>
        ))}
      </View>

      <Commentary>
        The BTC Pouch operates under the PTAI framework: every change is bound to
        a published trigger (Projection - Trigger - Action - Impact). There is
        no discretionary trading. Take-profit and accumulation triggers are the
        note's rule-based path to BTC accumulation over the term. Triggers and
        guardrails listed above are the rule set for the current vault state.
      </Commentary>

      <Text style={[styles.bodySmall, { marginTop: 8, color: COLORS.textDim }]}>
        Target exposure, triggers and guardrails are forward-looking and
        conditional on the stated assumptions. They describe the rule set, not a
        realised outcome: actual execution depends on live market conditions and
        is not guaranteed. Past performance does not indicate future results.
        Full disclaimers appear on page {totalPages}.
      </Text>

      <PageFooter pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  );
}
