import Link from "next/link";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";

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
      <ul className="pf-onboarding-foot__list">
        {AFTER_SUBSCRIBE.map((item) => (
          <li key={item.title} className="pf-onboarding-foot__item">
            <span className="stat-label">{item.title}</span>
            <span className="body-xs ct-text-muted">{item.detail}</span>
          </li>
        ))}
      </ul>
      <Link href="/proof-center" className="pf-onboarding-foot__link body-sm">
        Explore proof center →
      </Link>
      </PfCockpitPanel>
    </div>
  );
}
