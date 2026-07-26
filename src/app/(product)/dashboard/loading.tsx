import {
  RouteLoadingHeader,
  RouteLoadingKpiBand,
  RouteLoadingPage,
  RouteLoadingPanel,
} from "@/views/_shared/route-loading";

/**
 * Squelette de `/dashboard` — la page d'accueil investisseur n'en avait AUCUN.
 *
 * Sa géométrie rejoue celle de `dashboard-view` (en-tête → bande de 4 KPI →
 * grille 3 colonnes) : un squelette qui ne ressemble pas à ce qu'il remplace
 * produit un saut de layout à l'arrivée des données, c'est-à-dire exactement le
 * CLS qu'on cherche à éviter.
 *
 * `RouteLoadingKpiBand` existait déjà et n'était utilisé nulle part.
 */
export default function DashboardLoading() {
  return (
    <RouteLoadingPage label="Loading dashboard">
      <RouteLoadingHeader titleWidth="w-80" />
      <RouteLoadingKpiBand count={4} />
      <div className="grid gap-6 lg:grid-cols-3">
        <RouteLoadingPanel className="h-[320px] lg:col-span-2" />
        <RouteLoadingPanel className="h-[320px]" />
      </div>
    </RouteLoadingPage>
  );
}
