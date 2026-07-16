import "../../doc-flow.css";

/**
 * Mining layout — loads doc-flow typography + `.product-doc` scope so the bento/
 * metric classes resolve to the compact scale (root-cause fix, PROMPT 225).
 * Route kept off the primary rail (Dashboard drill-down) but fully styled.
 */
export default function MiningLayout({
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
