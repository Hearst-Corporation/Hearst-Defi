/**
 * Agent calibration — pure mapping from the onboarding questionnaire (Typeform
 * `QualificationProfile`) to an agent persona.
 *
 * NO I/O here: this is a deterministic, fully testable transform. The caller
 * (admin server action / Typeform webhook) persists the result into a
 * `UserAgentProfile` row, which `buildUserContextSystemBlock` then injects into
 * the system prompt. The mapping encodes the persona logic discussed for the
 * lead segments — register (who is asking), pedagogy (how versed they are),
 * verbosity (commercial weight) and which vault to surface (risk appetite).
 *
 * The output deliberately only sets TONE-style fields (`tone`, `language`,
 * `verbosity`, `customInstructions`) — never the hard guardrails (APY range,
 * forbidden words, disclaimers). Those stay owned by the system prompt; see the
 * GUARDRAIL_HEADER/FOOTER in `user-context.ts`.
 */

import type { VaultId } from "@/lib/engine/vaults";

// ---------------------------------------------------------------------------
// Questionnaire answer types (mirror QualificationProfile string columns)
// ---------------------------------------------------------------------------

export type PlatformType = "crypto" | "exchange" | "wealth" | "custody";
export type Aum = "lt_10m" | "10_50m" | "50_250m" | "250m_plus" | "unsure";
export type FundsUsage = "idle" | "mix" | "earning";
export type YieldStatus = "live" | "in_progress" | "not_yet";
export type YieldType = "low_risk" | "balanced" | "growth" | "unsure";
export type VaultSize =
  | "100_500k"
  | "500k_1m"
  | "1_5m"
  | "5m_plus"
  | "unsure";
export type Timeline = "asap" | "1_3m" | "3_6m" | "exploring";

export interface QualificationAnswers {
  platformType?: PlatformType | null;
  aum?: Aum | null;
  fundsUsage?: FundsUsage | null;
  yieldStatus?: YieldStatus | null;
  yieldType?: YieldType | null;
  vaultSize?: VaultSize | null;
  timeline?: Timeline | null;
  language?: "fr" | "en" | null;
}

export type Tone = "concise" | "detailed" | "technical";
export type Verbosity = "low" | "medium" | "high";

export interface CalibratedPersona {
  tone: Tone;
  language: "fr" | "en";
  verbosity: Verbosity;
  /** Composed, human-readable instructions (TONE only, guardrail-safe). */
  customInstructions: string;
  /** Vault to surface first given the stated risk appetite. */
  suggestedVault: VaultId;
  /** Coarse commercial tier derived from AUM + first vault size. */
  tier: "tier1" | "mid" | "explorer";
  /** Pedagogy level derived from yield maturity. */
  pedagogy: "teach" | "compare" | "peer";
  /** Short labels describing the derived segments, for admin display. */
  segments: string[];
}

// ---------------------------------------------------------------------------
// Sub-mappings (each pure, each defaulting safely on null / "unsure")
// ---------------------------------------------------------------------------

/** Register lexicon per platform segment (Q1). */
function registerForPlatform(p: PlatformType | null | undefined): {
  label: string;
  instruction: string;
} {
  switch (p) {
    case "crypto":
      return {
        label: "crypto-native",
        instruction:
          "Crypto-native counterpart: direct tone, DeFi/on-chain lexicon (ERC-4626, PoR, oracle), emphasise on-chain transparency and proofs.",
      };
    case "exchange":
      return {
        label: "exchange",
        instruction:
          "Exchange counterpart: stress client float activation, API/custody integration and USDC distribution.",
      };
    case "wealth":
      return {
        label: "wealth-platform",
        instruction:
          "Wealth-platform counterpart: understated institutional register, structured vocabulary (APY range, methodology, PPM/LPA), emphasise the Cayman SPV structure and compliance.",
      };
    case "custody":
      return {
        label: "custody-infra",
        instruction:
          "Custody/infra counterpart: focus on architecture, security, custody guardrails (cash model, zero owner outflow) and provenance/attestation.",
      };
    default:
      return {
        label: "segment-inconnu",
        instruction:
          "Platform segment unspecified: stay generic and institutional, ask a discovery question about their business before steering.",
      };
  }
}

/** Pedagogy level from yield maturity (Q3 funds usage × Q4 yield status). */
function pedagogyFor(
  fundsUsage: FundsUsage | null | undefined,
  yieldStatus: YieldStatus | null | undefined,
): { level: CalibratedPersona["pedagogy"]; label: string; instruction: string } {
  if (yieldStatus === "live") {
    return {
      level: "peer",
      label: "averti",
      instruction:
        "Sophisticated counterpart (yield already live): get straight to the point peer-to-peer, talk methodology, backtest and audit; skip the basic explanations.",
    };
  }
  if (yieldStatus === "in_progress" || fundsUsage === "mix" || fundsUsage === "earning") {
    return {
      level: "compare",
      label: "migrateur",
      instruction:
        "Counterpart mid-structuring: position Hearst against their existing product, stress differentiation and migration.",
    };
  }
  return {
    level: "teach",
    label: "greenfield",
    instruction:
      "Greenfield counterpart (idle funds, no yield yet): explain structured yield from the ground up, stay pedagogical and walk through the disclaimers.",
  };
}

/** Commercial tier from AUM (Q2) and first vault size (Q6). */
function tierFor(
  aum: Aum | null | undefined,
  vaultSize: VaultSize | null | undefined,
): { tier: CalibratedPersona["tier"]; label: string; instruction: string } {
  const tier1 = aum === "250m_plus" || vaultSize === "5m_plus";
  const mid =
    aum === "50_250m" || vaultSize === "1_5m" || vaultSize === "500k_1m";
  if (tier1) {
    return {
      tier: "tier1",
      label: "tier-1 white-glove",
      instruction:
        "Tier-1 account (heavyweight): premium register, high priority, offer a human contact and white-glove support.",
    };
  }
  if (mid) {
    return {
      tier: "mid",
      label: "mid-market",
      instruction:
        "Mid-market account: standard guided flow, efficient and concrete.",
    };
  }
  return {
    tier: "explorer",
    label: "explorer / small",
    instruction:
      "Exploratory account (small ticket / uncertain): self-serve discovery persona, qualify without over-investing, stay useful and brief.",
  };
}

/** Vault to surface + risk register from desired yield type (Q5). */
function vaultFor(y: YieldType | null | undefined): {
  vault: VaultId;
  instruction: string;
} {
  switch (y) {
    case "low_risk":
      return {
        vault: "defensive",
        instruction:
          "Low risk appetite: highlight the Hearst Defensive Vault (lower APY range, capital preservation).",
      };
    case "growth":
      return {
        vault: "btc-plus",
        instruction:
          'Growth appetite: highlight the Hearst BTC Plus (higher APY range) while clearly loading the "not guaranteed" disclaimers.',
      };
    case "balanced":
      return {
        vault: "yield",
        instruction:
          "Balanced appetite: highlight the Hearst Yield Vault (core of the range).",
      };
    default:
      return {
        vault: "yield",
        instruction:
          "Risk appetite unspecified: diagnostic persona, ask discovery questions before recommending a vault; default to presenting the Hearst Yield Vault.",
      };
  }
}

/** Closing vs nurturing tone from timeline (Q7). */
function timelineInstruction(t: Timeline | null | undefined): string {
  switch (t) {
    case "asap":
    case "1_3m":
      return "Short timeline: closer persona, propose concrete next steps and an onboarding outline.";
    case "3_6m":
      return "Medium timeline: keep interest alive with clear milestones.";
    case "exploring":
    default:
      return "Just exploring: nurturing persona, education and resources, no commercial pressure.";
  }
}

// ---------------------------------------------------------------------------
// calibratePersona — the single public entry point
// ---------------------------------------------------------------------------

/**
 * Maps questionnaire answers to a persona. Pure & total: every null/"unsure"
 * answer falls back to a safe, generic branch, so a fully empty profile still
 * yields a valid (neutral) persona.
 */
export function calibratePersona(
  answers: QualificationAnswers,
): CalibratedPersona {
  const register = registerForPlatform(answers.platformType);
  const ped = pedagogyFor(answers.fundsUsage, answers.yieldStatus);
  const tier = tierFor(answers.aum, answers.vaultSize);
  const vault = vaultFor(answers.yieldType);

  // Tone: technical for crypto/custody peers, detailed when teaching, concise
  // for time-pressed tier-1 / averti, else detailed by default.
  const technicalSegment =
    answers.platformType === "crypto" || answers.platformType === "custody";
  const tone: Tone =
    ped.level === "peer" && technicalSegment
      ? "technical"
      : ped.level === "teach"
        ? "detailed"
        : "concise";

  // Verbosity scales with pedagogy need and inversely with time pressure.
  const verbosity: Verbosity =
    ped.level === "teach"
      ? "high"
      : tier.tier === "tier1" || answers.timeline === "asap"
        ? "low"
        : "medium";

  const language = answers.language ?? "fr";

  const customInstructions = [
    register.instruction,
    ped.instruction,
    tier.instruction,
    vault.instruction,
    timelineInstruction(answers.timeline),
  ].join(" ");

  return {
    tone,
    language,
    verbosity,
    customInstructions,
    suggestedVault: vault.vault,
    tier: tier.tier,
    pedagogy: ped.level,
    segments: [register.label, ped.label, tier.label],
  };
}
