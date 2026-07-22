// doc-flow.css stays: /proof-center/full renders proof-card / doc-flow-tablist
// styled there. proof-center.css was removed — its 9 rules targeted admin-hub
// components (custody-panel, cold-shell) that never load this route's sheet,
// so they applied nowhere.
import "../../doc-flow.css";

export default function ProofCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc product-doc-shell w-full min-w-0">{children}</div>;
}
