import Link from "next/link";

import { BtcCompositionPanel } from "@/components/vaults/vault-composition-panel";
import { InvestForm } from "@/components/vaults/invest-form";
import type { AllocationPocketViewModel } from "@/features/investor-ui/types/dashboard";
import type { SessionUser } from "@/lib/auth/session";
import type { VaultProduct } from "@/lib/data/vaults";
import { investProductPath } from "@/lib/vaults/invest-routes";
import { series1DisplayName } from "@/lib/vaults/series1";
import type { Investor } from "@prisma/client";
import { InvestFlowShell } from "@/views/investor/invest-flow-shell";

function toSeries1Pockets(
  vault: VaultProduct,
): readonly AllocationPocketViewModel[] {
  return [
    {
      pocket: "B1",
      label: "Mining Power",
      targetBps: vault.targetMiningBps,
      actualBps: null,
    },
    {
      pocket: "B2",
      label: "BTC Pouch",
      targetBps: vault.targetBtcTacticalBps,
      actualBps: null,
    },
    {
      pocket: "B3",
      label: "Reserve USDC",
      targetBps: vault.targetStableReserveBps + vault.targetUsdcBaseBps,
      actualBps: null,
    },
  ];
}

export function InvestDepositView({
  vault,
  investor,
  session,
}: {
  vault: VaultProduct;
  investor: Investor | null;
  session: SessionUser | null;
}) {
  return (
    <InvestFlowShell
      step="deposit"
      width="full"
      lead={
        <Link
          href={investProductPath(vault.id)}
          className="text-sm text-accent hover:underline"
          aria-label="Back to term sheet"
        >
          ← Term sheet
        </Link>
      }
      titleLead="Allocate"
      titleAccent="capital"
      description={
        <span>
          {series1DisplayName(vault.name)} · {vault.ticker} · institutional
          subscription checkout on Base Sepolia testnet
        </span>
      }
      headerBelowStepper="Review allocation amount, wallet readiness, and confirm deposit"
    >
      <section
        role="region"
        aria-label="Where your capital is deployed"
        className="space-y-3"
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-subtle">
            Where your capital goes
          </p>
          <p className="text-xs text-faint">
            Your USDC is deployed across three on-chain pockets to accumulate
            Bitcoin over the 24-month term. Estimated return is disclosed as an
            accumulated BTC delivery range at maturity — not guaranteed.
          </p>
        </div>
        <BtcCompositionPanel
          pockets={toSeries1Pockets(vault)}
          totalBtc={null}
          provenance="simulated"
        />
      </section>

      <InvestForm
        vault={vault}
        investor={investor}
        session={session}
      />
    </InvestFlowShell>
  );
}
