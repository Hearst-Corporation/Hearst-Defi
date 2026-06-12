import "../product-doc.css";

export default function VaultsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc">{children}</div>;
}
