import {
  RouteLoadingHeader,
  RouteLoadingKpiBand,
  RouteLoadingPage,
  RouteLoadingPanel,
} from "@/views/_shared/route-loading";

export default function VaultsLoading() {
  return (
    <RouteLoadingPage label="Loading Series 1 Vault">
      <RouteLoadingHeader titleWidth="w-72" />
      <RouteLoadingKpiBand />
      <RouteLoadingPanel className="h-64" />
      <div className="grid gap-5 lg:grid-cols-2">
        <RouteLoadingPanel className="h-56" />
        <RouteLoadingPanel className="h-56" />
      </div>
    </RouteLoadingPage>
  );
}
