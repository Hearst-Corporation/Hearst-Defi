import type { ReactNode } from "react";

import { InvestorRailDebug } from "./_components/investor-rail-debug";

/**
 * Layout local au clone debug.
 *
 * Le shell racine (`AppChrome` → `ConnectShell` du package
 * `@hearst/cockpit-shell`) fournit déjà le frame visuel global (rail-left
 * vide, page-area, cockpit chat à droite). `AppChrome` monte aussi globalement
 * `<AdminChatControls />` qui pose la toolbar Conversation / Review DANS le
 * body du rail droit (admin-gated, se cache pour les non-admins).
 *
 * Ce layout y monte EN PLUS :
 *
 *   - `InvestorRailDebug` : le rail gauche (fork simplifié, portalisé).
 *
 * Modifier ce fichier ne touche QUE cette URL.
 *
 * Note : le rail prod (`InvestorRailIntra`) vit dans `(product)/layout.tsx`,
 * lui-même protégé par `requireInvestor` ; il n'est PAS chargé ici, donc pas
 * de double rail visible.
 */
export default function PortfolioFullDebugLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <InvestorRailDebug />
      {children}
    </>
  );
}
