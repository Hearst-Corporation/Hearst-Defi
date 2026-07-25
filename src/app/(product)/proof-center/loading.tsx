import {
  RouteLoadingHeader,
  RouteLoadingPage,
  RouteLoadingPanel,
} from "@/views/_shared/route-loading";

export default function ProofCenterLoading() {
  return (
    <RouteLoadingPage label="Loading Proof Center">
      <RouteLoadingHeader titleWidth="w-56" />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <RouteLoadingPanel className="h-72" />
        <RouteLoadingPanel className="h-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <RouteLoadingPanel key={i} className="h-28" />
        ))}
      </div>
    </RouteLoadingPage>
  );
}
