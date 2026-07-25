import { LegalPageHeader } from "@/components/legal/legal-page-header";

export const dynamic = "force-static";

export const metadata = {
  title: "Risk Disclaimer",
  description:
    "Risk factors specific to the Hearst Mining Note — Bitcoin mining economics, take-profit execution, the USDC reserve pocket, custody, and smart contracts.",
};

export default function DisclaimerPage() {
  return (
    <>
      <LegalPageHeader title="Risk Disclaimer" />

      <div className="legal-stub">
        <strong>Current review draft</strong>
        <p>
          The risk factors below reflect the actual architecture of the product
          (a Bitcoin-mining-backed accumulation note structured in three
          on-chain pockets, a Cayman SPV, a custody provider, smart contracts
          on Base). The legal language must be finalized by qualified counsel
          before formal issuance.
        </p>
      </div>

      <p>
        Hearst Mining Note is an institutional instrument backed by real
        Bitcoin mining. Capital is structured in three on-chain pockets
        (Mining Power, BTC Pouch, Reserve USDC) and accumulates Bitcoin over a
        24-month term, delivered at maturity — there is no periodic cash
        distribution and no fixed APY. Bitcoin price is an economic factor: it
        drives mining hashprice, and it is also the asset ultimately
        delivered. Investment involves substantial risk, including loss of
        principal. Estimated outcomes are disclosed as a range of accumulated
        BTC, based on disclosed assumptions; they are not guarantees,
        commitments, or predictions of future returns. Past performance does
        not predict future results.
      </p>

      <h2 className="h2">1. Mining economics risk (primary)</h2>
      <p>
        The note's BTC accumulation is funded by real Bitcoin mining
        economics. Mining output — and therefore the pace of accumulation —
        is sensitive to network hashprice, energy costs, network difficulty,
        fleet uptime, curtailment events, halving events, hardware
        availability, and regulatory action in mining jurisdictions. Adverse
        moves in any of these factors can slow, reduce, or in stressed
        scenarios halt accumulation toward the take-profit target, independent
        of Bitcoin's spot price. The rule-based take-profit program executes
        against disclosed triggers, not a fixed schedule: market conditions,
        on-chain conditions, or operational delays could affect the timing or
        completeness of an execution.
      </p>

      <h2 className="h2">2. Smart contract risk</h2>
      <p>
        On-chain components (the vault contract, event logger, proof-of-reserves
        registry) are deployed on Base. Smart contracts may contain
        undiscovered vulnerabilities. Mainnet deployment of the vault is gated
        on completion of a third-party security audit (Spearbit) and
        remediation of any findings. Even after audit, residual risk remains.
      </p>

      <h2 className="h2">3. Custody risk</h2>
      <p>
        Underlying assets are held with an institutional custody provider
        (Fireblocks). Proof-of-reserves attestations are published on a regular
        cadence. Custody failure, key compromise, or operational error at the
        custodian could result in loss.
      </p>

      <h2 className="h2">4. Liquidity &amp; lock-up risk</h2>
      <p>
        Subscriptions carry a 60-day soft lock-up. Because the note accumulates
        BTC over a 24-month term and delivers at maturity, early withdrawal
        requests outside the lock-up are processed at scheduled valuation
        points and may be deferred or gated in exceptional liquidity events.
        You should not subscribe with funds you may need on short notice.
      </p>

      <h2 className="h2">5. Regulatory &amp; jurisdiction risk</h2>
      <p>
        The SPV is incorporated in the Cayman Islands. Regulatory frameworks
        applicable to digital assets, Bitcoin mining, and Bitcoin-accumulation
        / mining-backed structured products continue to evolve. Changes in law
        or enforcement could materially affect the product or your ability to
        participate.
      </p>

      <h2 className="h2">6. Stablecoin &amp; redemption risk</h2>
      <p>
        A portion of capital — the Reserve USDC pocket — is held in USDC, a
        third-party issued stablecoin whose peg, redemption rights, and
        compliance posture are outside Hearst's control. This risk applies to
        that reserve pocket only: the BTC accumulated and delivered at
        maturity instead carries Bitcoin market risk (see Section 1).
      </p>

      <h2 className="h2">7. Operational &amp; counterparty risk</h2>
      <p>
        The product depends on third-party infrastructure (custody, hosting,
        oracles, KYC processors). Operational failure at any counterparty could
        affect product availability, BTC accumulation, delivery at maturity, or
        attestations.
      </p>

      <h2 className="h2">8. Tax</h2>
      <p>
        Tax treatment depends on your jurisdiction and personal circumstances.
        Hearst does not provide tax advice. Consult your own advisor.
      </p>

      <h2 className="h2">9. No guarantee</h2>
      <p>
        Nothing in the product communicates a guarantee, promise, or
        risk-free return. The estimated accumulated-BTC range is an estimate,
        not a periodic distribution and not a fixed APY. Delivery of the
        accumulated BTC at maturity is not guaranteed. Capital is at risk.
      </p>
    </>
  );
}
