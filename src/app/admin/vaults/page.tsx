import {
  AdminVaultsView,
  isVaultsFilterKey,
  type VaultsFilterKey,
} from "@/views/admin/vaults-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vaults — Hearst Connect Admin",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VaultsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawFilter = params["filter"];
  const activeFilter: VaultsFilterKey = isVaultsFilterKey(rawFilter)
    ? rawFilter
    : "all";

  return <AdminVaultsView activeFilter={activeFilter} />;
}
