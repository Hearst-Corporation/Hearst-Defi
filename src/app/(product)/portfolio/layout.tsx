import "../../doc-flow.css";

import { BlankCanvasMarker } from "@/components/portfolio/blank-canvas-marker";

/**
 * Portfolio layout — pose `data-blank-canvas` sur <html> AVANT le premier paint
 * (script inline synchrone → zéro flash du canvas DS au refresh), et le RETIRE
 * au démontage via <BlankCanvasMarker/> (navigation client vers vaults/profile :
 * sinon l'attribut resterait et neutraliserait leur canvas aussi).
 *
 * cockpit.css cible html[data-blank-canvas] → neutralise fond #191B22 + dot-grid
 * + bouton flottant "Master". FEUILLE BLANCHE : tant que /portfolio est en
 * reconstruction Catalyst.
 */
export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "document.documentElement.setAttribute('data-blank-canvas','');",
        }}
      />
      <BlankCanvasMarker />
      <div className="product-doc product-doc-shell w-full min-w-0">
        {children}
      </div>
    </>
  );
}
