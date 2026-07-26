import type { Metadata } from "next";

import "@/styles/app.css";

import { Analytics } from "@/components/analytics";
import { PrivyProvider } from "@/components/auth/privy-provider";
import { PRIVY_APP_ID } from "@/lib/auth/privy-config";
import { isDevAuthBypass } from "@/lib/dev-bypass";
import { GreenfieldChrome } from "@/shell/greenfield-chrome";
import { UI_PREFS_BOOT } from "@/shell/ui-prefs";
import { Toaster } from "@/ui/toast";

export const metadata: Metadata = {
  title: { default: "Hearst Connect", template: "%s | Hearst Connect" },
  description:
    "Hearst Mining Note — an institutional Bitcoin accumulation instrument backed by real Bitcoin mining. BTC accumulates over a 24-month term and is delivered at maturity; estimated outcomes are disclosed as a range, not guaranteed.",
  metadataBase: new URL("https://connect.hearst.app"),
  openGraph: {
    type: "website",
    siteName: "Hearst Connect",
    title: "Hearst Connect — Institutional Bitcoin Accumulation Note",
    description:
      "Backed by real Bitcoin mining. BTC accumulates over a 24-month term and is delivered at maturity — no periodic cash distribution, no fixed rate. Estimated outcomes are disclosed as a range, not guaranteed.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Hearst Connect — Bitcoin Accumulation Note",
    description:
      "Institutional Bitcoin accumulation instrument backed by real Bitcoin mining.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {/*
          PREMIER enfant du body, volontairement : ce script s'exécute de façon
          synchrone avant que le parseur n'atteigne le contenu suivant, donc
          avant toute peinture — c'est ce qui supprime le flash de thème. Il
          n'importe rien et ne dépend d'aucun bundle. Le serveur ne rend AUCUN
          attribut de thème, donc aucune incohérence d'hydratation n'est
          possible (et `suppressHydrationWarning` couvre la mutation du DOM).
        */}
        <script dangerouslySetInnerHTML={{ __html: UI_PREFS_BOOT }} />
        <a
          href="#main-content"
          className="hc-sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-(--z-overlay) focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:text-accent-foreground"
        >
          Skip to main content
        </a>
        <GreenfieldChrome>
          <PrivyProvider appId={isDevAuthBypass() ? "" : PRIVY_APP_ID}>
            {children}
            <Toaster />
          </PrivyProvider>
        </GreenfieldChrome>
        <Analytics />
      </body>
    </html>
  );
}
