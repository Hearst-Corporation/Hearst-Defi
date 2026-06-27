import "../../doc-flow.css";

/** Portfolio layout — feuille blanche (reconstruction Catalyst en cours). */
export default function PortfolioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="product-doc product-doc-shell w-full min-w-0">
      {children}
    </div>
  );
}
