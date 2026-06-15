import "../../doc-flow.css";

export default function ProofCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc product-doc-shell w-full min-w-0">{children}</div>;
}
