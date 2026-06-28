import Link from "next/link";

import { ProvenanceBadge } from "@/components/ui/provenance-badge";

/**
 * Unified institutional footer — one component, two densities.
 *
 * - `variant="full"` — the public "socle plein" used on "/" surfaces and
 *   /legal/*: four columns (Identity / Platform / Legal / Status) over a
 *   hairline sub-footer.
 * - `variant="compact"` — a single ~40px line pinned at the bottom of every
 *   authenticated Cockpit surface, preserving the no-scroll layout.
 *
 * Mounted once in AppChrome (compact on cockpit surfaces, full under the bare
 * branch for "/" and /legal/*). It also absorbs the old LegalLayout footer.
 *
 * Styling note — this is Tailwind-bento markup (canon Portfolio), BUT the
 * structural hooks `app-footer`, `app-footer--compact`, `app-footer--full`,
 * `app-footer__links`, `app-footer__brand`, `app-footer__diamond` are kept:
 * `cockpit.css` targets them for shell layout (footer pinning, grid aligned on
 * the rail columns, the dissolve `::before`, the bottom-bar offset). Only the
 * presentation (color/typography) moved from the legacy `ct-*` classes to
 * Tailwind utilities here.
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
      <footer
        className="app-footer app-footer--compact border-t border-white/5"
        aria-label="Legal"
      >
        <nav
          className="app-footer__links text-[12px]"
          aria-label="Legal links"
        >
          {LEGAL_LINKS.slice(0, 3).map((link, i) => (
            <span
              key={`${link.href}-${i}`}
              className="inline-flex items-center gap-2"
            >
              {i > 0 ? (
                <span className="text-zinc-700" aria-hidden>
                  ·
                </span>
              ) : null}
              <Link
                href={link.href}
                className="text-zinc-500 transition-colors hover:text-zinc-300"
              >
                {link.label}
              </Link>
            </span>
          ))}
        </nav>
        <span className="app-footer__brand text-[12px] text-zinc-500">
          <span aria-hidden className="app-footer__diamond text-[var(--ct-accent)]">
            ◆
          </span>
          Hearst Yield Vault
        </span>
      </footer>
    );
  }

  return (
    <footer
      className="app-footer app-footer--full border-t border-white/5"
      aria-label="Site footer"
    >
      <div className="app-footer__grid">
        <section className="app-footer__col">
          <p className="text-[11px] uppercase tracking-wider text-zinc-400">
            Hearst Yield Vault
          </p>
          <p className="app-footer__lede text-[13px] text-zinc-500">
            Mining-backed structured yield. Cayman SPV.
          </p>
        </section>

        <nav className="app-footer__col" aria-label="Platform">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Platform
          </p>
          {PLATFORM_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-[13px] text-zinc-400 transition-colors hover:text-zinc-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <nav className="app-footer__col" aria-label="Legal">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Legal
          </p>
          {LEGAL_LINKS.map((link, i) => (
            <Link
              key={`${link.href}-${i}`}
              href={link.href}
              className="text-[13px] text-zinc-400 transition-colors hover:text-zinc-300"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <section className="app-footer__col" aria-label="Status">
          <p className="text-[11px] uppercase tracking-wider text-zinc-500">
            Status
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] text-zinc-400">
            <ProvenanceBadge kind="live" variant="strip" />
            Vault live
          </span>
          <span className="text-[13px] text-zinc-400">{APY_RANGE}</span>
          <span className="text-[13px] text-zinc-500">Base · testnet</span>
        </section>
      </div>

      <div className="app-footer__sub text-[12px] text-zinc-500">
        <span>
          © 2026 Hearst · Qualified investors only · Cayman SPV · $250k min ·
          60-day soft lock-up.
        </span>
        <span className="text-zinc-400">not guaranteed · capital at risk</span>
      </div>
    </footer>
  );
}
