import { z } from "zod";

import { containsForbidden, FORBIDDEN_WORDS } from "@/lib/agents/forbidden-words";

/**
 * Vault create/draft schema — extracted from `actions.ts` so it can be exported
 * and reused (e.g. by the agent-canvas `create_vault_draft` write tool).
 *
 * WHY a separate module: `actions.ts` is `"use server"`, and Next.js only lets a
 * "use server" file export ASYNC FUNCTIONS. Exporting a Zod object from it throws
 * at runtime ("a 'use server' file can only export async functions, found
 * object"). This module has no `"use server"` directive, so the schema + enums +
 * the inferred type can be shared freely. Single source of truth for the 23
 * fields + cross-field refines (#1 APY range, #5 forbidden words, allocation
 * sum, signer quorum).
 */

export const FORBIDDEN_WORDS_HUMAN = FORBIDDEN_WORDS.join(" / ");

export function containsForbiddenWord(text: string): string | null {
  const result = containsForbidden(text);
  return result ? result.found[0] ?? null : null;
}

export const StrategyEnum = z.enum(["mining_yield", "btc_tactical", "stable_reserve"]);
export const SpvEnum = z.enum(["cayman", "bvi", "delaware", "lux"]);
export const RegExemptionEnum = z.enum(["regD_506c", "regS", "art2_lux"]);

export const CreateDraftSchema = z
  .object({
    ticker: z
      .string()
      .regex(/^[A-Z0-9-]{3,12}$/, "Ticker must be 3-12 uppercase letters/digits/hyphens"),
    name: z.string().min(3).max(80),
    description: z.string().optional(),
    strategy: StrategyEnum,
    colorTag: z.string().optional(),
    minTicketUsdc: z.number().min(1000),
    capacityUsdc: z.number().min(1000),
    mgmtFeeBps: z.number().min(0).max(500),
    perfFeeBps: z.number().min(0).max(3000),
    hurdleBps: z.number().min(0).max(2000).default(0),
    softLockupDays: z.number().min(0).max(365),
    targetApyLowBps: z.number().min(0),
    targetApyHighBps: z.number().min(0),
    spvJurisdiction: SpvEnum,
    shareClass: z
      .string()
      .regex(/^[A-Z]$/, "Share class must be a single uppercase letter"),
    regExemption: RegExemptionEnum,
    disclaimers: z
      .string()
      .min(80, "Disclaimers must be at least 80 characters")
      .refine((v) => {
        const hit = containsForbiddenWord(v);
        return hit === null;
      }, `Disclaimers contain a forbidden word (${FORBIDDEN_WORDS_HUMAN})`),
    targetMiningBps: z.number().min(0).max(10000),
    targetBtcTacticalBps: z.number().min(0).max(10000),
    targetUsdcBaseBps: z.number().min(0).max(10000),
    targetStableReserveBps: z.number().min(0).max(10000),
    signersWhitelist: z
      .array(z.string().min(1))
      .min(2, "At least 2 signers required")
      .max(5, "At most 5 signers allowed"),
    requiredSigners: z
      .number()
      .int()
      .min(2, "Required signers must be at least 2")
      .max(5, "Required signers must be at most 5"),
  })
  .refine((d) => d.targetApyHighBps > d.targetApyLowBps, {
    message: "targetApyHighBps must be strictly greater than targetApyLowBps",
    path: ["targetApyHighBps"],
  })
  .refine(
    (d) =>
      d.targetMiningBps +
        d.targetBtcTacticalBps +
        d.targetUsdcBaseBps +
        d.targetStableReserveBps ===
      10_000,
    {
      message:
        "Allocation bps must sum to exactly 10000 (targetMiningBps + targetBtcTacticalBps + targetUsdcBaseBps + targetStableReserveBps)",
      path: ["targetMiningBps"],
    },
  )
  .refine(
    (d) => {
      if (!d.description) return true;
      return containsForbiddenWord(d.description) === null;
    },
    {
      message: `Description contains a forbidden word (${FORBIDDEN_WORDS_HUMAN})`,
      path: ["description"],
    },
  )
  .refine((d) => d.requiredSigners <= d.signersWhitelist.length, {
    message:
      "requiredSigners cannot exceed the number of signers in signersWhitelist",
    path: ["requiredSigners"],
  })
  .refine((d) => containsForbiddenWord(d.name) === null, {
    message: `Name contains a forbidden word (${FORBIDDEN_WORDS_HUMAN})`,
    path: ["name"],
  });

export type CreateDraftInput = z.infer<typeof CreateDraftSchema>;
