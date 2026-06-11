"use server";

import { z } from "zod";

import { runInvestorMemo } from "@/lib/agents/investor-memo";
import { loadMemoInput } from "@/lib/agents/loaders/vault";
import type { InvestorMemoOutput } from "@/lib/agents/schemas";
import { requireAuth } from "@/lib/auth/require-auth";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";

const VaultIdSchema = z.enum(["yield", "defensive", "btc-plus"] as const);

/**
 * Generates an investor memo via the GPT-4.1 agent (OpenAI, ADR-011) using live vault data.
 *
 * Rate limited to 5 calls per minute per user.
 *
 * ADR-006 #9: the memo is bound to a single vault. `vaultId` defaults to the
 * Hearst Yield Vault; any other id (defensive, btc-plus) drives the memo to
 * use that vault's OWN apy range, name, and assumptions — never another
 * vault's projections.
 */
export async function generateMemoAction(
  vaultId?: string,
): Promise<InvestorMemoOutput> {
  const { userId } = await requireAuth();
  try {
    await assertRateLimit(`generate-memo:${userId}`, 5, 60_000);
    const resolvedVaultId =
      vaultId === undefined ? undefined : VaultIdSchema.parse(vaultId);
    const input = await loadMemoInput(resolvedVaultId);
    return await runInvestorMemo(input, { userId });
  } catch (err) {
    logger.error("generateMemoAction failed", { userId }, err);
    throw err;
  }
}
