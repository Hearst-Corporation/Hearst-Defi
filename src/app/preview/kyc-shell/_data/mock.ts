/** Static placeholder data — preview only, no backend. */

export const SERIES1 = {
  fullName: "Hearst Bitcoin Reserve Vault — Series 1",
  tagline: "Smart-contract governed Bitcoin reserve construction",
  ticker: "HBRS1",
  methodology: "Methodology v3.0",
} as const;

export const HERO_STATUSES = [
  { label: "Permissioned", tone: "accent" as const },
  { label: "No leverage", tone: "zinc" as const },
  { label: "BTC delivery", tone: "accent" as const },
  { label: "Proof pending", tone: "amber" as const },
] as const;

export const KPI_METRICS = [
  {
    label: "Target BTC reserve",
    value: "42.50 BTC",
    hint: "Contractual delivery target at maturity",
  },
  {
    label: "B1 mining power",
    value: "18.4 PH/s",
    hint: "Attributed hashrate — preview",
  },
  {
    label: "B2 reserve balance",
    value: "$12.4M",
    hint: "BTC reserve construction sleeve",
  },
  {
    label: "B3 runway",
    value: "14.2 mo",
    hint: "Operating reserve coverage",
  },
  {
    label: "Proof status",
    value: "Pending",
    hint: "On-chain attestation queue",
  },
] as const;

export const ALLOCATION_POCKETS = [
  { code: "B1", label: "B1 Mining Power", target: "40%", amount: "$8.7M", note: "Hashrate procurement" },
  { code: "B2", label: "B2 BTC Reserve", target: "27%", amount: "$5.9M", note: "Reserve construction" },
  { code: "B3", label: "B3 Operating Reserve", target: "33%", amount: "$7.2M", note: "Reserve runway" },
] as const;

export const CONSTRUCTION_STEPS = [
  { phase: "Phase 1", label: "Capital formation", status: "Complete", detail: "Permissioned intake closed" },
  { phase: "Phase 2", label: "Mining power deployment", status: "Active", detail: "B1 hashrate ramp" },
  { phase: "Phase 3", label: "BTC accumulation", status: "Active", detail: "Credits indexed to reserve" },
  { phase: "Phase 4", label: "Maturity delivery", status: "Scheduled", detail: "BTC delivery at term" },
] as const;

export const MATURITY_ROWS = [
  { label: "Maturity date", value: "Jun 2028" },
  { label: "Delivery instrument", value: "BTC on-chain" },
  { label: "Smart contract receipt", value: "0x71a4…9f2e" },
  { label: "Governance", value: "Permissioned vault" },
] as const;

export const RECEIPT_ROWS = [
  { label: "Vault address", value: "0x8c2f…a41b" },
  { label: "Series", value: "Series 1" },
  { label: "Receipt hash", value: "0xd91e…7c03" },
  { label: "Last attestation", value: "Pending" },
] as const;

export const RIGHT_RAIL = {
  proof: [
    "Mining attribution records — preview",
    "Reserve balance attestation — pending",
    "Smart contract receipt — indexed",
  ],
  risk: [
    "No leverage — structural",
    "Permissioned investor set",
    "BTC delivery at maturity only",
  ],
  operator: [
    "Shell preview — no live positions",
    "Charts are stylized placeholders",
    "Operator review surface only",
  ],
} as const;

export const LINE_CHART_POINTS = [12, 18, 16, 22, 28, 26, 34, 38, 36, 42, 45, 48] as const;

export const MATURITY_TIMELINE = [
  { year: "2026", label: "Formation", done: true },
  { year: "2027", label: "Construction", done: true },
  { year: "2028", label: "Delivery", done: false },
] as const;
