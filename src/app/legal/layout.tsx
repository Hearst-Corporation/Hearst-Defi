import Link from "next/link";

import "../doc-flow.css";
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
        <Link href="/" className="legal-back body-lg ct-text-strong">
          Hearst Connect
        </Link>
        <nav className="legal-nav body-sm" aria-label="Legal documents">
          <Link href="/legal/privacy">Privacy</Link>
          <Link href="/legal/terms">Terms</Link>
          <Link href="/legal/disclaimer">Disclaimer</Link>
        </nav>
      </header>
      <article className="legal-body">{children}</article>
      {/* The institutional footer (AppChrome, variant="full") renders below this
          layout on /legal/* — it carries the legal disclaimer and links, so no
          local footer here. */}
    </div>
  );
}
