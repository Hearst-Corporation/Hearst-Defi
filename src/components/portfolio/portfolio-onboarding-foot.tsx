import Link from "next/link";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Button } from "@/components/ui/button";

const AFTER_SUBSCRIBE = [
  {
    title: "Capital & yield",
    detail: "Allocation and forward yield range after confirmation.",
  },
  {
    title: "Payout calendar",
    detail: "Monthly USDC distribution schedule.",
  },
  {
    title: "Recent activity",
    detail: "Deposits, payouts and withdrawals.",
  },
  {
    title: "Trust & proof",
    detail: "Risk composite and on-chain attestation.",
  },
] as const;

/** Single compact secondary strip for previewZeros — no four tall empty cards. */
export function PortfolioOnboardingFoot() {
  return (
    <div data-testid="portfolio-onboarding-foot">
      <PfCockpitPanel
        variant="compact"
        aria-label="Portfolio widgets after first position"
        className="pf-onboarding-foot"
      >
      <PfCockpitPanelHeader
        title="What unlocks next"
        subtitle="Live cockpit widgets after your first confirmed position"
        titleVariant="primary"
      />
      <ul className="pf-onboarding-foot__list m-0 p-0 list-none">
        {AFTER_SUBSCRIBE.map((item) => (
          <li key={item.title} className="product-doc-stack--compact">
            <span className="stat-label">{item.title}</span>
            <span className="body-sm ct-text-muted">{item.detail}</span>
          </li>
        ))}
      </ul>
      <div className="product-doc-stack--actions">
        <Button variant="ghost" size="md" asChild className="w-full sm:w-auto">
          <Link href="/proof-center">Explore proof center →</Link>
        </Button>
      </div>
      </PfCockpitPanel>
    </div>
  );
}
