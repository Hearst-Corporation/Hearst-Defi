import Link from "next/link";

import "../(product)/product-doc.css";
import "./legal.css";

export const dynamic = "force-static";

export const metadata = {
  title: "Legal",
  description:
    "Legal documentation for Hearst Connect — institutional RWA yield vault backed by Bitcoin mining cash flows.",
};

export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="product-doc legal-shell">
      <header className="legal-header">
        <Link href="/" className="legal-back">
          Hearst Connect
        </Link>
        <nav className="legal-nav" aria-label="Legal documents">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/disclaimer">Disclaimer</Link>
        </nav>
      </header>
      <article className="legal-body">{children}</article>
      <footer className="legal-footer">
        <p className="body-xs ct-text-faint">
          Hearst Yield Vault — Cayman SPV. This documentation is provided for
          informational purposes and does not constitute investment, legal, or
          tax advice. APY ranges are target projections, not guarantees.
        </p>
      </footer>
    </div>
  );
}
