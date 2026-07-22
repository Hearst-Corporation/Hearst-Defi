export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <div className="w-full min-w-0">{children}</div>;
}
