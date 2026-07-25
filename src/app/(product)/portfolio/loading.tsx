import {
  RouteLoadingHeader,
  RouteLoadingPage,
  RouteLoadingPanel,
} from "@/views/_shared/route-loading";

export default function PortfolioLoading() {
  return (
    <RouteLoadingPage label="Loading portfolio">
      <RouteLoadingHeader titleWidth="w-40" />
      <RouteLoadingPanel className="h-64" />
    </RouteLoadingPage>
  );
}
