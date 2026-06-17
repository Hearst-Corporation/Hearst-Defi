// Keep the previous dashboard paint during soft navigations (vault pills, return
// from another admin route). Data still refreshes via unstable_cache in the
// loaders — no skeleton swap that unmounts the live board.
export default function DashboardLoading() {
  return null;
}
