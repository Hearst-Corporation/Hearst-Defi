import "../product-doc.css";

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="product-doc w-full min-w-0">{children}</div>;
}
