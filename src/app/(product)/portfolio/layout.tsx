import "../../doc-flow.css";
import "@/components/dev/grid-overlay.css";

import { GridOverlay } from "@/components/dev/grid-overlay";

/** Portfolio layout — feuille blanche (reconstruction Catalyst en cours). */
export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="product-doc product-doc-shell w-full min-w-0">
        {children}
      </div>
      <GridOverlay />
    </>
  );
}
