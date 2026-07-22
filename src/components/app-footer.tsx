import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { SERIES1_NAME } from "@/lib/vaults/series1";

/**
 * Institutional footer — the public "socle plein" used on /legal/* (mounted by
 * AppChrome's bare branch): four columns (Identity / Platform / Legal / Status)
 * over a hairline sub-footer. The old `compact` variant died with the no-scroll
 * cockpit shell — no call site ever passed it.
 *
 * Styling note — Tailwind-bento markup, but the structural hooks `app-footer`,
 * `app-footer--full`, `app-footer__*` are kept: `cockpit.css` targets them for
 * shell layout.
 */

// One link per live investor surface — the folded routes (/btc, /mining,
// /my-vaults) are redirect stubs and must not be advertised.
const PLATFORM_LINKS = [
  { href: "/dashboard" as const, label: "Overview" },
  { href: "/vaults" as const, label: "Series 1 Vault" },
  { href: "/portfolio" as const, label: "My Position" },
  { href: "/proof-center" as const, label: "Proof" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/disclaimer" as const, label: "Disclaimer" },
  { href: "/legal/privacy" as const, label: "Privacy" },
  { href: "/legal/terms" as const, label: "Terms" },
  // No dedicated risk-disclosure route — the disclaimer carries it.
  { href: "/legal/disclaimer" as const, label: "Risk Disclosure" },
] as const;

// Series 1 pays no rate and makes no periodic distribution, so the footer
// states the delivery term instead of any rate label.
const TERM_LABEL = "24-month term · delivered in BTC";

export function AppFooter({ variant: _variant = "full" }: { variant?: "full" }) {
  return (
    <footer
      className="app-footer app-footer--full border-t border-[var(--ct-border-soft)]"
      aria-label="Site footer"
    >
      <div className="app-footer__grid">
        <section className="app-footer__col">
          <p className="text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-muted)]">
            {SERIES1_NAME}
          </p>
          <p className="app-footer__lede text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">
            Mining-backed Bitcoin reserve. Cayman SPV.
          </p>
        </section>

        <nav className="app-footer__col" aria-label="Platform">
          <p className="text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-faint)]">
            Platform
          </p>
          {PLATFORM_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-body)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="app-footer__col" aria-label="Legal">
          <p className="text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-faint)]">
            Legal
          </p>
          {LEGAL_LINKS.map((link, i) => (
            <Link
              key={`${link.href}-${i}`}
              href={link.href}
              className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)] transition-colors hover:text-[var(--ct-text-body)]"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="app-footer__col" aria-label="Status">
          <p className="text-[length:var(--ct-text-micro)] uppercase tracking-wider text-[var(--ct-text-faint)]">
            Status
          </p>
          <span className="inline-flex items-center gap-2 text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">
            <ProvenanceBadge kind="live" variant="strip" />
            Vault live
          </span>
          <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-muted)]">{TERM_LABEL}</span>
          <span className="text-[length:var(--ct-text-xs)] text-[var(--ct-text-faint)]">Base · testnet</span>
        </section>
      </div>

      <div className="app-footer__sub text-[length:var(--ct-text-2xs)] text-[var(--ct-text-faint)]">
        <span>
          © 2026 Hearst · Qualified investors only · Cayman SPV · $250k min ·
          60-day soft lock-up.
        </span>
        <span className="text-[var(--ct-text-muted)]">not guaranteed · capital at risk</span>
      </div>
    </footer>
  );
}
