import "../product-doc.css";

export default function ProofCenterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc">{children}</div>;
}
