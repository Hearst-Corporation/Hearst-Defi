import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { cn } from "@/lib/cn";

/**
 * Unified institutional footer — one component, two densities.
 *
 * - `variant="full"` — the "socle plein" black plinth used on public surfaces
 *   ("/" and /legal/*): four columns (Identity / Platform / Legal / Status) over
 *   a hairline sub-footer.
 * - `variant="compact"` — a single ~40px line pinned at the bottom of every
 *   authenticated Cockpit surface, preserving the no-scroll layout. Replaces the
 *   former quiet legal strip.
 *
 * Mounted once in AppChrome (compact on cockpit surfaces, full under the bare
 * branch for "/" and /legal/*). It also absorbs the old LegalLayout footer.
 */

const PLATFORM_LINKS = [
  { href: "/portfolio" as const, label: "Portfolio" },
  { href: "/vaults" as const, label: "Vaults" },
  { href: "/proof-center" as const, label: "Proof Center" },
] as const;

const LEGAL_LINKS = [
  { href: "/legal/disclaimer" as const, label: "Disclaimer" },
  { href: "/legal/privacy" as const, label: "Privacy" },
  { href: "/legal/terms" as const, label: "Terms" },
  // No dedicated risk-disclosure route — the disclaimer carries it.
  { href: "/legal/disclaimer" as const, label: "Risk Disclosure" },
] as const;

// apyRangeLabel is computed per-projection (src/lib/engine/projection.ts), not a
// stable constant available to a static footer. Render a generic, honest label
// with no invented number.
const APY_RANGE = "APY range";

interface AppFooterProps {
  variant?: "full" | "compact";
}

export function AppFooter({ variant = "full" }: AppFooterProps) {
  if (variant === "compact") {
    return (
      <footer className="app-footer app-footer--compact" aria-label="Legal">
        <span className="app-footer__brand body-xs ct-text-faint">
          <span aria-hidden className="app-footer__diamond">
            ◆
          </span>
          Hearst Yield Vault
        </span>
        <nav className="app-footer__links" aria-label="Legal links">
          {LEGAL_LINKS.slice(0, 3).map((link, i) => (
            <span key={`${link.href}-${i}`} className="app-footer__item">
              {i > 0 ? (
                <span className="ct-text-faint" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link
                href={link.href}
                className="body-xs ct-text-faint app-footer__link"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <span className="app-footer__status body-xs ct-text-faint">
          <ProvenanceBadge kind="live" variant="strip" />
          Service live · {APY_RANGE} · © 2026
        </span>
      </footer>
    );
  }

  return (
    <footer className="app-footer app-footer--full" aria-label="Site footer">
      <div className="app-footer__grid">
        <section className="app-footer__col">
          <p className="eyebrow ct-text-muted">Hearst Yield Vault</p>
          <p className="body-sm ct-text-faint app-footer__lede">
            Mining-backed structured yield. Cayman SPV.
          </p>
        </section>

        <nav className="app-footer__col" aria-label="Platform">
          <p className="stat-label ct-text-faint">Platform</p>
          {PLATFORM_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="body-sm ct-text-muted app-footer__link"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="app-footer__col" aria-label="Legal">
          <p className="stat-label ct-text-faint">Legal</p>
          {LEGAL_LINKS.map((link, i) => (
            <Link
              key={`${link.href}-${i}`}
              href={link.href}
              className="body-sm ct-text-muted app-footer__link"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="app-footer__col" aria-label="Status">
          <p className="stat-label ct-text-faint">Status</p>
          <span className="app-footer__status body-sm ct-text-muted">
            <ProvenanceBadge kind="live" variant="strip" />
            Vault live
          </span>
          <span className="body-sm ct-text-muted">{APY_RANGE}</span>
          <span className="body-sm ct-text-faint">Base · testnet</span>
        </section>
      </div>

      <div className="app-footer__sub body-xs ct-text-faint">
        <span>
          © 2026 Hearst · Qualified investors only · Cayman SPV · $250k min ·
          60-day soft lock-up.
        </span>
        <span className={cn("app-footer__sub-note")}>
          not guaranteed · capital at risk
        </span>
      </div>
    </footer>
  );
}
