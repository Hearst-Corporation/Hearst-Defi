import "./legal.css";

import Link from "next/link";

import { LegalPageHeader } from "@/components/legal/legal-page-header";

export const dynamic = "force-static";

export const metadata = {
  title: "Legal",
  description: "Legal documentation index for Hearst Connect.",
};

export default function LegalIndexPage() {
  return (
    <>
      <LegalPageHeader title="Legal" />
      <p className="legal-meta body-xs ct-text-faint">Effective date — to be finalized.</p>
      <p>
        Hearst Connect is operated as a Cayman Islands SPV (Hearst Yield Vault).
        The documents below cover privacy, terms of service, and risk
        disclosures for prospective and existing investors. Each document is a
        draft engineering version pending formal legal review.
      </p>
      <nav className="legal-index" aria-label="Legal documents">
        <Link href="/legal/privacy">
          <strong>Privacy Policy</strong>
          <span>How we collect, store, and process investor data (KYC/AML, session, analytics).</span>
        </Link>
        <Link href="/legal/terms">
          <strong>Terms of Service</strong>
          <span>Eligibility, subscription mechanics, withdrawal terms, governing law.</span>
        </Link>
        <Link href="/legal/disclaimer">
          <strong>Risk Disclaimer</strong>
          <span>DeFi, smart contract, mining, custody, and market risks. APY range is not a guarantee.</span>
        </Link>
      </nav>
    </>
  );
}
