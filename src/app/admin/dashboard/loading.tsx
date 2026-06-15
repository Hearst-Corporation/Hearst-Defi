// No skeleton — the dashboard is force-dynamic and loads all data in one pass.
// A skeleton here blocks the render when the SSR Suspense boundary times out
// in dev (Turbopack), leaving the loading state permanently visible.
export default function DashboardLoading() {
  return null;
}
