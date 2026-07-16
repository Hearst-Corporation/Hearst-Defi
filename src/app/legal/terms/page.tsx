import "../legal.css";

import Link from "next/link";

import { LegalPageHeader } from "@/components/legal/legal-page-header";

export const dynamic = "force-static";

export const metadata = {
  title: "Terms of Service",
  description: "Hearst Connect terms of service — eligibility, subscription, withdrawal, governing law.",
};

export default function TermsPage() {
  return (
    <>
      <LegalPageHeader title="Terms of Service" />

      <div className="legal-stub">
        <strong>Current review draft</strong>
        <p>
          The structure below reflects the product mechanics actually
          implemented (Cayman SPV vault, $250k minimum ticket, 60-day soft
          lock-up, BTC accumulated over a 24-month term and delivered at
          maturity). The legal language must be finalized by qualified
          counsel before becoming the binding execution version.
        </p>
      </div>

      <h2 className="h2">1. Issuer</h2>
      <p>
        Hearst Yield Vault SPV, an exempted company incorporated under the laws
        of the Cayman Islands.
      </p>

      <h2 className="h2">2. Eligibility</h2>
      <p>
        Subscriptions are restricted to accredited or professional investors,
        as defined by the applicable jurisdiction. You represent and warrant
        that you meet these requirements and have completed KYC / AML
        onboarding before any subscription is accepted.
      </p>

      <h2 className="h2">3. Subscription mechanics</h2>
      <ul>
        <li>Minimum ticket: USD 250,000 equivalent, settled in USDC.</li>
        <li>Subscriptions accepted at the next valuation point following deposit confirmation.</li>
        <li>Shares are non-transferable except as expressly permitted.</li>
      </ul>

      <h2 className="h2">4. BTC accumulation, take-profit, and estimated range</h2>
      <p>
        The note accumulates Bitcoin over a 24-month term, governed by a
        rule-based take-profit program described in the product
        documentation. There is no periodic cash distribution and no fixed
        APY. Estimated outcomes are displayed as a range of accumulated BTC,
        never as a single point estimate, and are conditional on the
        assumptions disclosed in the methodology document. Past performance
        does not predict future results.
      </p>

      <h2 className="h2">5. Lock-up and withdrawals</h2>
      <p>
        A 60-day soft lock-up applies to each subscription. Withdrawal requests
        outside the lock-up are processed at the next valuation point, subject
        to liquidity. The vault reserves the right to gate or defer withdrawals
        in exceptional liquidity events.
      </p>

      <h2 className="h2">6. Fees</h2>
      <p>
        Management and performance fees are disclosed in the per-vault
        documentation and reflected in the disclosed estimated accumulation
        range.
      </p>

      <h2 className="h2">7. Risks</h2>
      <p>
        Investment involves substantial risk, including loss of principal. See
        the{" "}
        <Link href="/legal/disclaimer">risk disclaimer</Link> for a detailed list of
        risk factors specific to Bitcoin mining economics, take-profit
        execution, the USDC reserve pocket, custody, and smart contracts.
      </p>

      <h2 className="h2">8. Governing law &amp; jurisdiction</h2>
      <p>
        These terms are governed by the laws of the Cayman Islands. Any dispute
        is subject to the exclusive jurisdiction of the courts of the Cayman
        Islands, save where mandatory consumer or investor protections require
        otherwise.
      </p>

      <h2 className="h2">9. Modifications</h2>
      <p>
        Material modifications to these terms will be communicated to investors
        and require continued use to be deemed accepted.
      </p>
    </>
  );
}
