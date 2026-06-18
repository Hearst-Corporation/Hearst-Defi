import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PORTFOLIO_ONBOARDING_INVEST_HREF } from "@/lib/portfolio/layout-preview";

const UNLOCKS = [
  {
    title: "Proof of Reserves",
    detail: "On-chain attestation after the first vault period closes.",
  },
  {
    title: "Mining cash-flow",
    detail: "Partner revenue coverage and calibration inputs.",
  },
  {
    title: "Distributions & events",
    detail: "USDC payouts, rebalances, and the on-chain event log.",
  },
  {
    title: "Off-chain proofs",
    detail: "Audits, custody snapshots, and methodology documents.",
  },
] as const;

/** Compact cold proof center — primary CTA + secondary unlock list (no fake charts). */
export function ProofCenterColdShell({
  chainConfigured,
}: {
  chainConfigured: boolean;
}) {
  return (
    <div
      className="proof-center-cold product-doc-stack product-doc-stack--tight"
      data-testid="proof-center-cold-shell"
    >
      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-3)]">
        <div className="product-doc-stack product-doc-stack--tight">
          <p className="eyebrow m-0">Status</p>
          <h2 className="h3 m-0">Proof system active — awaiting vault activity</h2>
          <p className="body-sm ct-text-muted m-0">
            {chainConfigured
              ? "Contracts are deployed on a test network. Attestations, distributions, and event logs publish once the vault operates."
              : "On-chain proof modules activate after deployment. Off-chain documents publish as operations posts them."}
          </p>
        </div>
        <Link
          href={PORTFOLIO_ONBOARDING_INVEST_HREF}
          className="proof-center-cold__cta inline-flex items-center justify-center self-start min-h-[2.75rem] px-[var(--ct-space-5)] py-[var(--ct-space-2_5)] rounded-full font-bold ct-bg-accent ct-text-on-accent ct-bg-accent-strong-hover ct-transition-base ct-focus-ring ct-press text-sm no-underline whitespace-nowrap"
        >
          Subscribe to vault
        </Link>
      </Card>

      <Card hoverOverlay={false} contentClassName="flex flex-col gap-[var(--ct-space-2)]">
        <p className="stat-label m-0">What unlocks when the vault operates</p>
        <ul className="proof-center-cold__list m-0 p-0 list-none flex flex-col gap-[var(--ct-space-2)]">
          {UNLOCKS.map((item) => (
            <li key={item.title} className="flex flex-col gap-[var(--ct-space-0_5)]">
              <span className="body-sm ct-text-primary font-semibold">{item.title}</span>
              <span className="body-xs ct-text-muted">{item.detail}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
