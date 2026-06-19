import Link from "next/link";

import {
  PfCockpitPanel,
  PfCockpitPanelHeader,
} from "@/components/portfolio/pf-cockpit-panel";
import { Button } from "@/components/ui/button";
import { ApyRange } from "@/components/ui/apy-range";
import {
  PORTFOLIO_ONBOARDING_APY,
  PORTFOLIO_ONBOARDING_INVEST_HREF,
  PORTFOLIO_ONBOARDING_LOCKUP_DAYS,
  PORTFOLIO_ONBOARDING_MIN_TICKET_USDC,
} from "@/lib/portfolio/layout-preview";

const ticketFmt = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

/** Hero CTA for previewZeros — onboarding cockpit, no chart / no fake data. */
export function PortfolioOnboardingHero() {
  return (
    <PfCockpitPanel
      variant="wide"
      aria-label="Get started with Hearst Yield Vault"
      className="pf-onboarding-hero"
    >
      <PfCockpitPanelHeader
        title="Get started"
        subtitle="Subscribe to Hearst Yield Vault"
        titleVariant="primary"
      />

      <dl className="pf-onboarding-hero__terms">
        <div className="pf-onboarding-hero__term">
          <dt className="stat-label">Target APY</dt>
          <dd className="body-sm ct-text-primary font-semibold tabular-nums m-0">
            <ApyRange
              low={PORTFOLIO_ONBOARDING_APY.low}
              high={PORTFOLIO_ONBOARDING_APY.high}
              suffix="%"
            />
          </dd>
        </div>
        <div className="pf-onboarding-hero__term">
          <dt className="stat-label">Min ticket</dt>
          <dd className="body-sm ct-text-primary font-semibold tabular-nums m-0">
            {ticketFmt.format(PORTFOLIO_ONBOARDING_MIN_TICKET_USDC)}
          </dd>
        </div>
        <div className="pf-onboarding-hero__term">
          <dt className="stat-label">Lock-up</dt>
          <dd className="body-sm ct-text-primary font-semibold tabular-nums m-0">
            {PORTFOLIO_ONBOARDING_LOCKUP_DAYS} days
          </dd>
        </div>
      </dl>

      <div className="product-doc-stack--actions">
        <Button variant="primary" size="lg" asChild>
          <Link href={PORTFOLIO_ONBOARDING_INVEST_HREF}>Subscribe to vault</Link>
        </Button>
        <p className="body-xs ct-text-faint m-0">
          APY shown as a range · not guaranteed
        </p>
      </div>
    </PfCockpitPanel>
  );
}
