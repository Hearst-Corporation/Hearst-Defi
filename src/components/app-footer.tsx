import Link from "next/link";

/**
 * Global legal footer — rendered once in AppChrome on every authenticated
 * product/admin surface so the mandatory legal pages (Disclaimer / Privacy /
 * Terms) are reachable everywhere, not only from the Profile page.
 *
 * Bare routes (login, auth, /legal/*) opt out via AppChrome's isBareRoute, so
 * this never double-renders on pages that carry their own legal chrome.
 */
const LEGAL_LINKS = [
  { href: "/legal/disclaimer", label: "Disclaimer" },
  { href: "/legal/privacy", label: "Privacy Policy" },
  { href: "/legal/terms", label: "Terms of Use" },
] as const;

export function AppFooter() {
  return (
    <footer className="app-footer" aria-label="Legal">
      <nav className="app-footer__links" aria-label="Legal links">
        {LEGAL_LINKS.map((link, i) => (
          <span key={link.href} className="app-footer__item">
            {i > 0 ? (
              <span className="ct-text-faint" aria-hidden="true">
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
    </footer>
  );
}
