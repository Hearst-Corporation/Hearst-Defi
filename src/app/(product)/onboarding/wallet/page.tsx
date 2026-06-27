/**
 * Step 3 — Wallet binding (optional). Persists via bindWallet.
 */

import { EmptySurface } from "@/components/ui/empty-surface";
import { WalletChamber } from "@/components/onboarding/privy-wallet-connect";
import { getInvestor } from "@/lib/auth/session";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";
import { requireWalletStepAccess } from "@/lib/onboarding/gates";

export const dynamic = "force-dynamic";

export default async function WalletPage() {
  const gateStatus = await requireWalletStepAccess();

  const investor = await getInvestor();
  const walletBound = (investor?.walletAddress ?? "").length > 0;

  if (gateStatus === "db_unavailable") {
    return (
      <section
        className="dark rounded-2xl border border-white/10 bg-black shadow-sm overflow-hidden flex flex-col mx-auto w-full max-w-2xl"
        data-testid="onboarding-wallet"
      >
        <div className="flex flex-col gap-2 p-5 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-zinc-500">
            Onboarding · Step 3 of 3
          </p>
          <h1 className="text-[22px] font-medium text-white leading-none tracking-tight">
            Connect your wallet
          </h1>
          <p className="text-[13px] text-zinc-400 leading-relaxed text-pretty">
            Identity verification is temporarily unavailable. Please try again
            later or contact support.
          </p>
        </div>
        <div className="p-5">
          <EmptySurface
            live
            variant="inline"
            message="Verification service unavailable"
            detail="The KYC gate cannot run until database migrations are applied."
          />
        </div>
      </section>
    );
  }

  return (
    <WalletChamber
      appId={PRIVY_APP_ID}
      boundAddress={investor?.walletAddress ?? null}
      walletBound={walletBound}
    />
  );
}
