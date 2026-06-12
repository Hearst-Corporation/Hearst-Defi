import { StyleSheet, Text, View } from "@react-pdf/renderer";

import { PDF_LIGHT } from "@/lib/pdf/pdf-palette";

/**
 * PDF mirror of the web `<ProvenanceBadge>` primitive (CLAUDE.md §2 —
 * "Every metric has a provenance badge").
 *
 * Why a dedicated component:
 *   - `@react-pdf/renderer` does not accept ReactDOM primitives, so we cannot
 *     reuse `src/components/ui/provenance-badge.tsx` directly.
 *   - All metrics printed to PDF (LP statements, monthly investor memo, etc.)
 *     must carry their provenance — this gives the renderer one canonical
 *     element to drop next to a `Text` value.
 *   - The colour ramp is sourced from `pdf-palette` (print ink on white).
 *
 * The set of kinds mirrors the 7 kinds exposed by the web badge
 * (`live | oracle | attested | estimated | partial | manual | stale`).
 */

export type PdfProvenanceKind =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "partial"
  | "manual"
  | "stale";

const LABELS: Record<PdfProvenanceKind, string> = {
  live: "Live",
  oracle: "Oracle",
  attested: "Attested",
  estimated: "Estimated",
  partial: "Partial",
  manual: "Manual",
  stale: "Stale",
};

/**
 * Foreground (dot + ink) colour for each kind, sourced from `PDF_LIGHT`.
 *
 * Mapping mirrors the web `<ProvenanceBadge>` variants:
 *   live      → success (green, on-chain confirmed)
 *   oracle    → brand   (saturated brand green, oracle-grade)
 *   attested  → brand   (saturated brand green, signed attestation)
 *   estimated → warning (amber, model output)
 *   partial   → warning (amber, partial coverage)
 *   manual    → textMuted (neutral grey, human-curated)
 *   stale     → textDim   (faded grey, freshness expired)
 */
const FG: Record<PdfProvenanceKind, string> = {
  live: PDF_LIGHT.statusSuccess,
  oracle: PDF_LIGHT.brand,
  attested: PDF_LIGHT.brand,
  estimated: PDF_LIGHT.statusWarning,
  partial: PDF_LIGHT.statusWarning,
  manual: PDF_LIGHT.textMuted,
  stale: PDF_LIGHT.textDim,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  label: {
    fontSize: 7,
    letterSpacing: 0.4,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
  },
});

interface PdfProvenanceProps {
  kind: PdfProvenanceKind;
  /**
   * Optional extra label printed in muted grey after the badge — useful
   * for compact tables ("Live · Chainlink", "Attested · multisig").
   */
  hint?: string;
  /** Override marginTop for layout fine-tuning. Defaults to 0. */
  marginTop?: number;
}

export function PdfProvenance({
  kind,
  hint,
  marginTop = 0,
}: PdfProvenanceProps) {
  const colour = FG[kind];
  return (
    <View style={[styles.row, { marginTop }]}>
      <View style={[styles.dot, { backgroundColor: colour }]} />
      <Text style={[styles.label, { color: colour }]}>{LABELS[kind]}</Text>
      {hint ? (
        <Text
          style={{
            fontSize: 7,
            color: PDF_LIGHT.textDim,
            letterSpacing: 0.4,
          }}
        >
          · {hint}
        </Text>
      ) : null}
    </View>
  );
}
