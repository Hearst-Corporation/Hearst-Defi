import { Text, View } from "@react-pdf/renderer";

import {
  PdfProvenance,
  type PdfProvenanceKind,
} from "./components/pdf-provenance";
import { styles } from "./memo-styles";

export function PageHeader({ period }: { period: string }) {
  return (
    <View>
      <View style={styles.pageHeader} fixed>
        <Text style={styles.pageHeaderEyebrow}>
          HEARST YIELD VAULT &mdash; MONTHLY MEMO
        </Text>
        <Text style={styles.pageHeaderPeriod}>{period}</Text>
      </View>
      <View style={styles.pageHeaderAccent} fixed />
    </View>
  );
}

export function PageFooter({
  pageNumber,
  totalPages,
}: {
  pageNumber: number;
  totalPages: number;
}) {
  return (
    <View style={styles.pageFooter} fixed>
      <Text style={styles.pageFooterText}>CONFIDENTIAL</Text>
      <Text style={styles.pageFooterText}>
        PAGE {pageNumber} / {totalPages}
      </Text>
    </View>
  );
}

export function EyebrowTitle({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <View>
      <Text style={styles.eyebrow}>{eyebrow}</Text>
      <Text style={styles.h1}>{title}</Text>
    </View>
  );
}

export function KpiCell({
  label,
  value,
  hint,
  provenance,
}: {
  label: string;
  value: string;
  hint?: string;
  /**
   * Provenance badge printed under the value. Mandatory per CLAUDE.md §2
   * for every metric reaching investors. Optional only for non-numeric
   * descriptors (e.g. "Methodology v3.0") — but should be passed where
   * meaningful.
   */
  provenance?: PdfProvenanceKind;
}) {
  return (
    <View style={styles.kpiCell}>
      <Text style={styles.kpiCellLabel}>{label}</Text>
      <Text style={styles.kpiCellValue}>{value}</Text>
      {hint ? <Text style={styles.kpiCellHint}>{hint}</Text> : null}
      {provenance ? (
        <View style={{ marginTop: 4 }}>
          <PdfProvenance kind={provenance} />
        </View>
      ) : null}
    </View>
  );
}

export type PillTone = "success" | "warning" | "danger" | "neutral" | "brand";

function toneStyle(tone: PillTone) {
  switch (tone) {
    case "success":
      return styles.pillSuccess;
    case "warning":
      return styles.pillWarning;
    case "danger":
      return styles.pillDanger;
    case "brand":
      return styles.pillBrand;
    case "neutral":
    default:
      return styles.pillNeutral;
  }
}

export function StatusPill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: PillTone;
}) {
  return <Text style={[styles.pill, toneStyle(tone)]}>{label}</Text>;
}

export function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletDot}>&bull;</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

export function Commentary({ children }: { children: string }) {
  return (
    <View style={styles.sectionCommentary}>
      <Text style={styles.bodySmall}>{children}</Text>
    </View>
  );
}
