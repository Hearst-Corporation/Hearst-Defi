export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Full-height link in the cockpit chain: the SidebarLayout content card is
  // `grow`, so this wrapper must carry that height down to Series1DashboardPage
  // instead of collapsing to content height (which left dead space below the
  // last block). h-full + flex-col lets the page stretch and fill the plane.
  return <div className="flex h-full min-h-full w-full min-w-0 flex-col">{children}</div>;
}
