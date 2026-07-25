import { AdminDistributionsView } from "@/views/admin/distributions-view";

export const dynamic = "force-dynamic";

interface DistributionsPageProps {
  searchParams: Promise<{ vault?: string }>;
}

export default async function DistributionsPage({
  searchParams,
}: DistributionsPageProps) {
  const params = await searchParams;
  return <AdminDistributionsView vaultParam={params.vault} />;
}
