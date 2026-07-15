import { StyleSheet } from "@react-pdf/renderer";

import { PDF_ALLOCATION, PDF_LIGHT } from "@/lib/pdf/pdf-palette";

/**
 * Print-friendly token set for the Hearst Investor Memo PDF.
 *
 * Light theme on purpose — this asset is mailed to LP committees, never the
 * dashboard dark mode. Brand green stays restricted to fine accents (rules,
 * eyebrow titles, status pills) so the document reads as a serious document
 * rather than a marketing splash.
 */
export const COLORS = {
  bg: PDF_LIGHT.bg,
  bgMuted: PDF_LIGHT.bgMuted,
  bgRow: PDF_LIGHT.bgRow,
  textPrimary: PDF_LIGHT.textPrimary,
  textMuted: PDF_LIGHT.textMuted,
  textDim: PDF_LIGHT.textDim,
  brand: PDF_LIGHT.brand,
  brandStrong: PDF_LIGHT.brandStrong,
  border: PDF_LIGHT.border,
  borderStrong: PDF_LIGHT.borderStrong,
  danger: PDF_LIGHT.statusDanger,
  warning: PDF_LIGHT.statusWarning,
  success: PDF_LIGHT.statusSuccess,
} as const;

/**
 * Font family used across the document. react-pdf does not accept the
 * `woff2-variations` Satoshi file bundled in `/public/fonts`, so we fall back
 * to Helvetica (a built-in family in react-pdf). The visual identity is
 * carried by the brand-green accent rules, the eyebrow grammar, and the
 * spacing rhythm, not the typeface itself.
 */
const FONT_FAMILY = "Helvetica" as const;
const FONT_FAMILY_BOLD = "Helvetica-Bold" as const;

export const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.bg,
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 48,
    paddingRight: 48,
  },
  // ---- Cover ----------------------------------------------------------------
  coverPage: {
    backgroundColor: COLORS.bg,
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    paddingTop: 72,
    paddingBottom: 56,
    paddingLeft: 56,
    paddingRight: 56,
  },
  coverTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  coverWordmark: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 22,
    letterSpacing: 4,
    color: COLORS.textPrimary,
  },
  coverWordmarkAccent: {
    color: COLORS.textPrimary,
  },
  coverBrandDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.brand,
    marginTop: 6,
  },
  coverRule: {
    marginTop: 36,
    height: 2,
    width: 56,
    backgroundColor: COLORS.brand,
  },
  coverTitle: {
    marginTop: 28,
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 32,
    lineHeight: 1.15,
    color: COLORS.textPrimary,
    letterSpacing: -0.5,
  },
  coverSubtitle: {
    marginTop: 14,
    fontSize: 13,
    color: COLORS.textMuted,
    lineHeight: 1.5,
    maxWidth: 360,
  },
  coverKpiGrid: {
    marginTop: 56,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  coverKpi: {
    width: "48%",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 6,
    padding: 14,
  },
  coverKpiLabel: {
    fontSize: 8,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: FONT_FAMILY_BOLD,
  },
  coverKpiValue: {
    marginTop: 6,
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 18,
    color: COLORS.textPrimary,
  },
  coverKpiHint: {
    marginTop: 4,
    fontSize: 9,
    color: COLORS.textMuted,
  },
  coverFooter: {
    position: "absolute",
    left: 56,
    right: 56,
    bottom: 48,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  coverFooterText: {
    fontSize: 8.5,
    color: COLORS.textMuted,
    letterSpacing: 0.6,
  },
  // ---- Page chrome ----------------------------------------------------------
  pageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 22,
  },
  pageHeaderEyebrow: {
    fontSize: 8,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: FONT_FAMILY_BOLD,
  },
  pageHeaderPeriod: {
    fontSize: 8,
    color: COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: FONT_FAMILY_BOLD,
  },
  pageHeaderAccent: {
    height: 2,
    width: 28,
    backgroundColor: COLORS.brand,
    marginBottom: 18,
  },
  pageFooter: {
    position: "absolute",
    left: 48,
    right: 48,
    bottom: 28,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  pageFooterText: {
    fontSize: 8,
    color: COLORS.textDim,
    letterSpacing: 0.8,
    textTransform: "uppercase",
    fontFamily: FONT_FAMILY_BOLD,
  },
  // ---- Typography roles -----------------------------------------------------
  eyebrow: {
    fontSize: 8.5,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontFamily: FONT_FAMILY_BOLD,
    marginBottom: 6,
  },
  h1: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 22,
    color: COLORS.textPrimary,
    marginBottom: 14,
    letterSpacing: -0.4,
  },
  h2: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 13,
    color: COLORS.textPrimary,
    marginTop: 18,
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.textPrimary,
  },
  bodyMuted: {
    fontSize: 10,
    lineHeight: 1.55,
    color: COLORS.textMuted,
  },
  bodySmall: {
    fontSize: 9,
    lineHeight: 1.5,
    color: COLORS.textMuted,
  },
  // ---- Layout helpers -------------------------------------------------------
  row: {
    flexDirection: "row",
  },
  twoColGrid: {
    flexDirection: "row",
    gap: 14,
    marginTop: 6,
  },
  twoColItem: {
    flexGrow: 1,
    flexBasis: 0,
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  // ---- KPI cell -------------------------------------------------------------
  kpiCell: {
    padding: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    flexGrow: 1,
    flexBasis: 0,
  },
  kpiCellLabel: {
    fontSize: 7.5,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1.2,
    fontFamily: FONT_FAMILY_BOLD,
  },
  kpiCellValue: {
    marginTop: 4,
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  kpiCellHint: {
    marginTop: 3,
    fontSize: 8,
    color: COLORS.textMuted,
  },
  // ---- Table ----------------------------------------------------------------
  table: {
    marginTop: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: COLORS.bgMuted,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableHeaderCell: {
    fontSize: 7.5,
    color: COLORS.textDim,
    textTransform: "uppercase",
    letterSpacing: 1,
    fontFamily: FONT_FAMILY_BOLD,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  tableRowAlt: {
    backgroundColor: COLORS.bgRow,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  tableCell: {
    fontSize: 9.5,
    color: COLORS.textPrimary,
  },
  tableCellMuted: {
    fontSize: 9.5,
    color: COLORS.textMuted,
  },
  // ---- Status pills ---------------------------------------------------------
  pill: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 3,
    fontSize: 8,
    fontFamily: FONT_FAMILY_BOLD,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    alignSelf: "flex-start",
  },
  pillSuccess: {
    backgroundColor: PDF_LIGHT.statusSuccessSoft,
    color: COLORS.success,
  },
  pillWarning: {
    backgroundColor: PDF_LIGHT.statusWarningSoft,
    color: COLORS.warning,
  },
  pillDanger: {
    backgroundColor: PDF_LIGHT.statusDangerSoft,
    color: COLORS.danger,
  },
  pillNeutral: {
    backgroundColor: COLORS.bgMuted,
    color: COLORS.textMuted,
  },
  pillBrand: {
    backgroundColor: PDF_LIGHT.statusSuccessBrandTint,
    color: COLORS.brandStrong,
  },
  // ---- Section structure ----------------------------------------------------
  sectionCommentary: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.bgMuted,
    borderLeftWidth: 2,
    borderLeftColor: COLORS.brand,
    borderRadius: 2,
  },
  bullet: {
    flexDirection: "row",
    marginBottom: 4,
  },
  bulletDot: {
    width: 10,
    fontSize: 10,
    color: COLORS.brand,
    fontFamily: FONT_FAMILY_BOLD,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
    color: COLORS.textPrimary,
  },
  // ---- Allocation chart -----------------------------------------------------
  allocationLegend: {
    marginTop: 14,
  },
  allocationLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },
  allocationSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    marginRight: 8,
  },
  allocationLabel: {
    width: 110,
    fontSize: 9.5,
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY_BOLD,
  },
  allocationPct: {
    width: 50,
    fontSize: 9.5,
    color: COLORS.textPrimary,
    fontFamily: FONT_FAMILY_BOLD,
  },
  allocationHint: {
    fontSize: 9,
    color: COLORS.textMuted,
    flex: 1,
  },
  disclaimerBox: {
    marginTop: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 4,
    backgroundColor: COLORS.bgMuted,
  },
});

export const ALLOCATION_PALETTE: Record<string, string> = {
  mining: PDF_ALLOCATION.mining,
  usdc_base: PDF_ALLOCATION.usdc_base,
  btc_tactical: PDF_ALLOCATION.btc_tactical,
  stable_reserve: PDF_ALLOCATION.stable_reserve,
};

// PermissionedDynaVault v2.1 pockets (spec §Appendix), mapped onto the existing
// engine bucket keys so the memo needs no engine enum change:
//   mining       -> B1 Mining Power  (40% / 4000 bps)
//   btc_tactical -> B2 BTC Pouch     (27% / 2700 bps)
//   usdc_base    -> B3 Reserve USDC  (33% / 3300 bps)
// `stable_reserve` is the superseded v1.0 sleeve; kept defensively in case a
// legacy engine payload still emits it.
export const ALLOCATION_LABELS: Record<string, string> = {
  mining: "B1 · Mining Power",
  btc_tactical: "B2 · BTC Pouch",
  usdc_base: "B3 · Reserve USDC",
  stable_reserve: "Reserve (legacy)",
};

export const ALLOCATION_HINTS: Record<string, string> = {
  mining:
    "Buys hashrate (RWA-backed) and mines BTC — the note's primary BTC-accumulation engine. Output floats with hashprice and energy cost.",
  btc_tactical:
    "Holds BTC and runs the rule-based take-profit sleeve. No discretionary trading; PTAI triggers only.",
  usdc_base:
    "USDC reserve. Funds the electricity account, re-entry windows, and the drawdown buffer.",
  stable_reserve:
    "Legacy stable reserve — superseded by the three-pocket structure.",
};
