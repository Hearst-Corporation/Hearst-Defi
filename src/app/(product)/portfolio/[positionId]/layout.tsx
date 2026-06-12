import "../../product-doc.css";

export default function PositionDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc">{children}</div>;
}
