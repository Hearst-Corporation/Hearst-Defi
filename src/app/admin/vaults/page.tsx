import { AdminVaultsView } from "@/views/admin/vaults-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Vaults — Hearst Connect Admin",
};

const FILTER_TABS = ["all", "draft", "review", "live", "paused", "closed"] as const;
type FilterKey = (typeof FILTER_TABS)[number];

function isFilterKey(v: unknown): v is FilterKey {
  return FILTER_TABS.includes(v as FilterKey);
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function VaultsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawFilter = params["filter"];
  const activeFilter: FilterKey = isFilterKey(rawFilter) ? rawFilter : "all";

  return <AdminVaultsView activeFilter={activeFilter} />;
}
