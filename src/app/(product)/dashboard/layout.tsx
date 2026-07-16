import "../../doc-flow.css";
import "@/components/investor-widgets/investor-widgets.css";

/**
 * Dashboard layout — loads the doc-flow typography sheet and applies the
 * `.product-doc` scope so the bento/metric classes this V2 route emits
 * (`.ct-bento-*`, `.ct-metric-*`, `.h1` canon) resolve to the compact
 * institutional scale instead of falling back to the 16px body. Same pattern
 * portfolio/vaults/profile/proof-center already use. (Root-cause fix, PROMPT 225.)
 */
export default function DashboardLayout({
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
