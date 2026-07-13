"use server";

/**
 * /withdrawals — investor-facing server action.
 *
 * REQUEST-ONLY, never auto-executing — this is the single most sensitive
 * custodial surface in the product (non-negotiable #5: no financial/custodial
 * action from the chat, ever; and no autonomous settlement anywhere). Calling
 * this action creates exactly ONE `Withdrawal` row with status "pending" and
 * moves ZERO funds. It never touches custody, never calls a wallet/chain
 * client, and never sets status past "pending" — only an admin server action
 * (`src/app/admin/withdrawals/actions.ts`, requireAdmin-gated, multisig) can
 * advance the state machine, and only after an out-of-band custody release.
 */

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";

import { getInvestor } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import { assertRateLimit } from "@/lib/rate-limit";
import { findAllowlistEntryByAddress } from "@/lib/governance/allowlist-queries";
import { loadBitcoinReserveView } from "@/lib/data/bitcoin-reserve-view";

/** Investor withdrawal-request rate limit: 5 requests / 60s / investor. */
const WITHDRAWAL_RATE_MAX = 5;
const WITHDRAWAL_RATE_WINDOW_MS = 60_000;

/**
 * Conservative flat fee estimate (BTC), documented as a placeholder — NOT a
 * live fee-estimation API call. Kept intentionally small and static; the real
 * network fee is settled off-chain by custody operations at release time and
 * has no bearing on the requested amount itself.
 */
const FLAT_ESTIMATED_FEE_BTC = 0.0005;

const NetworkSchema = z.enum(["bitcoin", "lightning"]);

const RequestWithdrawalSchema = z.object({
  walletAddress: z.string().trim().min(1, "Wallet address is required."),
  amountBtc: z.number().finite().positive("Amount must be a positive number."),
  network: NetworkSchema,
});

export type RequestWithdrawalInput = z.infer<typeof RequestWithdrawalSchema>;

export type RequestWithdrawalResult =
  | { ok: true; withdrawalId: string }
  | { ok: false; error: string };

/**
 * Creates a pending withdrawal request for the authenticated investor.
 *
 * Guards, in order:
 *   1. requireInvestor-equivalent session check (getInvestor()).
 *   2. Rate limit (per-investor).
 *   3. Zod validation of the input shape.
 *   4. Address allowlist check — the destination address must be an ACTIVE
 *      `AddressAllowlist` entry, or the request is rejected outright (never
 *      silently allowed).
 *   5. Snapshot the current BTC price for the USD/BTC reference fields.
 *   6. Create exactly one `Withdrawal` row, status "pending".
 *
 * This function NEVER: touches custody, calls a wallet/chain client, or sets
 * status past "pending". It is not reachable from the cockpit chat and has no
 * corresponding LLM tool (see src/lib/llm/tools/registry.ts).
 */
export async function requestWithdrawal(
  input: RequestWithdrawalInput,
): Promise<RequestWithdrawalResult> {
  const investor = await getInvestor();
  if (!investor) {
    throw new Error("Authentication required. Please log in.");
  }

  try {
    await assertRateLimit(
      `investor:withdrawals:${investor.id}`,
      WITHDRAWAL_RATE_MAX,
      WITHDRAWAL_RATE_WINDOW_MS,
    );
  } catch {
    return { ok: false, error: "Too many requests. Please try again shortly." };
  }

  const parsed = RequestWithdrawalSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { walletAddress, amountBtc, network } = parsed.data;

  // Address allowlist check — reject outright if not found/active. Never
  // silently allow an address that hasn't been vetted by custody governance.
  const allowlistEntry = await findAllowlistEntryByAddress(walletAddress);
  if (!allowlistEntry) {
    return {
      ok: false,
      error:
        "This wallet address is not on the approved withdrawal allowlist. Contact your relationship manager to add it before requesting a withdrawal.",
    };
  }

  // Snapshot the current BTC price for the USD reference fields recorded at
  // request time (never re-derived later — this is a point-in-time snapshot).
  const { btcPrice } = await loadBitcoinReserveView();
  const btcUsdAtRequest = btcPrice.value;
  const amountUsdcSnapshot = amountBtc * btcUsdAtRequest;

  let withdrawalId: string;
  try {
    const created = await prisma.withdrawal.create({
      data: {
        investorId: investor.id,
        walletAddress,
        network,
        amountBtc: new Prisma.Decimal(amountBtc),
        amountUsdcSnapshot: new Prisma.Decimal(amountUsdcSnapshot),
        btcUsdAtRequest: new Prisma.Decimal(btcUsdAtRequest),
        estimatedFeeBtc: new Prisma.Decimal(FLAT_ESTIMATED_FEE_BTC),
        status: "pending",
      },
      select: { id: true },
    });
    withdrawalId = created.id;
  } catch (err) {
    logger.error(
      "[withdrawals] requestWithdrawal failed",
      { investorId: investor.id },
      err instanceof Error ? err : undefined,
    );
    return { ok: false, error: "Could not submit withdrawal request. Please try again." };
  }

  logger.info("[withdrawals] request created", {
    investorId: investor.id,
    withdrawalId,
    network,
  });

  revalidatePath("/withdrawals");

  return { ok: true, withdrawalId };
}
