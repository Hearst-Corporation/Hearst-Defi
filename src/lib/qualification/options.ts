export type QualificationFieldName =
  | "platformType"
  | "aum"
  | "fundsUsage"
  | "yieldStatus"
  | "yieldType"
  | "vaultSize"
  | "timeline";

export interface QualificationOption {
  value: string;
  label: string;
}

export interface QualificationFieldDefinition {
  name: QualificationFieldName;
  shortLabel: string;
  questionLabel: string;
  options: readonly QualificationOption[];
}

export const PLATFORM_TYPE_OPTIONS = [
  { value: "wealth", label: "Wealth manager / family office" },
  { value: "crypto", label: "Crypto-native / DeFi" },
  { value: "exchange", label: "Crypto exchange / OTC desk" },
  { value: "custody", label: "Custodian / infrastructure" },
  { value: "other", label: "Other" },
] as const satisfies readonly QualificationOption[];

export const AUM_OPTIONS = [
  { value: "lt_10m", label: "< $10M" },
  { value: "10_50m", label: "$10M – $50M" },
  { value: "50_250m", label: "$50M – $250M" },
  { value: "250m_plus", label: "$250M+" },
  { value: "unsure", label: "Not sure / prefer not to say" },
] as const satisfies readonly QualificationOption[];

export const FUNDS_USAGE_OPTIONS = [
  { value: "idle", label: "Mostly sitting unused / idle" },
  { value: "mix", label: "A mix of both" },
  { value: "earning", label: "Mostly earning yield already" },
] as const satisfies readonly QualificationOption[];

export const YIELD_STATUS_OPTIONS = [
  { value: "live", label: "Yes, we're live" },
  { value: "in_progress", label: "In progress / building" },
  { value: "not_yet", label: "Not yet" },
] as const satisfies readonly QualificationOption[];

export const YIELD_TYPE_OPTIONS = [
  { value: "low_risk", label: "Low-risk / capital preservation" },
  { value: "balanced", label: "Balanced risk / return" },
  { value: "growth", label: "Growth / higher return" },
  { value: "unsure", label: "Not sure yet" },
] as const satisfies readonly QualificationOption[];

export const VAULT_SIZE_OPTIONS = [
  { value: "100_500k", label: "$100K – $500K" },
  { value: "500k_1m", label: "$500K – $1M" },
  { value: "1_5m", label: "$1M – $5M" },
  { value: "5m_plus", label: "$5M+" },
  { value: "unsure", label: "Not sure yet" },
] as const satisfies readonly QualificationOption[];

export const TIMELINE_OPTIONS = [
  { value: "asap", label: "ASAP" },
  { value: "1_3m", label: "1 – 3 months" },
  { value: "3_6m", label: "3 – 6 months" },
  { value: "exploring", label: "Just exploring" },
  { value: "unsure", label: "Not sure yet" },
] as const satisfies readonly QualificationOption[];

export const QUALIFICATION_FIELD_DEFINITIONS = [
  {
    name: "platformType",
    shortLabel: "Platform",
    questionLabel: "What best describes your platform?",
    options: PLATFORM_TYPE_OPTIONS,
  },
  {
    name: "aum",
    shortLabel: "AUM",
    questionLabel: "Assets under management?",
    options: AUM_OPTIONS,
  },
  {
    name: "fundsUsage",
    shortLabel: "Funds usage",
    questionLabel: "How are client funds currently deployed?",
    options: FUNDS_USAGE_OPTIONS,
  },
  {
    name: "yieldStatus",
    shortLabel: "Yield product",
    questionLabel: "Do you offer yield or reward products?",
    options: YIELD_STATUS_OPTIONS,
  },
  {
    name: "yieldType",
    shortLabel: "Yield interest",
    questionLabel: "What type of yield product suits your clients?",
    options: YIELD_TYPE_OPTIONS,
  },
  {
    name: "vaultSize",
    shortLabel: "Vault size",
    questionLabel: "Vault size for a first allocation?",
    options: VAULT_SIZE_OPTIONS,
  },
  {
    name: "timeline",
    shortLabel: "Timeline",
    questionLabel: "What is your launch timeline?",
    options: TIMELINE_OPTIONS,
  },
] as const satisfies readonly QualificationFieldDefinition[];

export const PLATFORM_TYPE_VALUES = PLATFORM_TYPE_OPTIONS.map((option) => option.value) as [
  (typeof PLATFORM_TYPE_OPTIONS)[number]["value"],
  ...(typeof PLATFORM_TYPE_OPTIONS)[number]["value"][],
];

export const AUM_VALUES = AUM_OPTIONS.map((option) => option.value) as [
  (typeof AUM_OPTIONS)[number]["value"],
  ...(typeof AUM_OPTIONS)[number]["value"][],
];

export const FUNDS_USAGE_VALUES = FUNDS_USAGE_OPTIONS.map((option) => option.value) as [
  (typeof FUNDS_USAGE_OPTIONS)[number]["value"],
  ...(typeof FUNDS_USAGE_OPTIONS)[number]["value"][],
];

export const YIELD_STATUS_VALUES = YIELD_STATUS_OPTIONS.map((option) => option.value) as [
  (typeof YIELD_STATUS_OPTIONS)[number]["value"],
  ...(typeof YIELD_STATUS_OPTIONS)[number]["value"][],
];

export const YIELD_TYPE_VALUES = YIELD_TYPE_OPTIONS.map((option) => option.value) as [
  (typeof YIELD_TYPE_OPTIONS)[number]["value"],
  ...(typeof YIELD_TYPE_OPTIONS)[number]["value"][],
];

export const VAULT_SIZE_VALUES = VAULT_SIZE_OPTIONS.map((option) => option.value) as [
  (typeof VAULT_SIZE_OPTIONS)[number]["value"],
  ...(typeof VAULT_SIZE_OPTIONS)[number]["value"][],
];

export const TIMELINE_VALUES = TIMELINE_OPTIONS.map((option) => option.value) as [
  (typeof TIMELINE_OPTIONS)[number]["value"],
  ...(typeof TIMELINE_OPTIONS)[number]["value"][],
];
