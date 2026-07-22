// doc-flow.css stays: /vaults/[id]/invest renders InvestFlowShell, whose
// product-doc-shell--cap/--narrow rules live there. vaults.css was dead
// (10 rules, zero rendered consumers) and was removed.
import "../../doc-flow.css";

export default function VaultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc product-doc-shell w-full min-w-0">{children}</div>;
}
