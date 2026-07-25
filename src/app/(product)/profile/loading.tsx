import {
  RouteLoadingHeader,
  RouteLoadingPage,
  RouteLoadingPanel,
} from "@/views/_shared/route-loading";

export default function ProfileLoading() {
  return (
    <RouteLoadingPage label="Loading Documents & KYC">
      <RouteLoadingHeader titleWidth="w-64" />
      {Array.from({ length: 4 }, (_, i) => (
        <RouteLoadingPanel key={i} className="h-44" />
      ))}
    </RouteLoadingPage>
  );
}
