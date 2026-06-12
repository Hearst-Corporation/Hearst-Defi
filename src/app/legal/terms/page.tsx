import "../legal.css";

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
      <p className="legal-meta body-xs ct-text-faint">Draft — pending formal legal review.</p>

      <div className="legal-stub">
        <strong>Engineering draft</strong>
        <p>
          The structure below reflects the product mechanics actually
          implemented (Cayman SPV vault, $250k minimum ticket, 60-day soft
          lock-up, monthly USDC distributions). The legal language must be
          reviewed and finalized by qualified counsel before binding investors.
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

      <h2 className="h2">4. Yield, distributions, and APY range</h2>
      <p>
        Target net APY range and distribution schedule are described in the
        product documentation. The APY is displayed as a range, never as a
        single point estimate, and is conditional on the assumptions disclosed
        in the methodology document. Past performance does not predict future
        results.
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
        documentation and reflected in the published net APY range.
      </p>

      <h2 className="h2">7. Risks</h2>
      <p>
        Investment involves substantial risk, including loss of principal. See
        the{" "}
        <a href="/legal/disclaimer">risk disclaimer</a> for a detailed list of
        risk factors specific to Bitcoin mining revenue, distribution coverage,
        the USDC principal reserve, custody, and smart contracts.
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
