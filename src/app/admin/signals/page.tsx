import { AdminSignalsView } from "@/views/admin/signals-view";

export const dynamic = "force-dynamic";

interface SignalsPageProps {
  searchParams: Promise<{ status?: string; vault?: string }>;
}

export default async function SignalsPage({ searchParams }: SignalsPageProps) {
  const params = await searchParams;
  return (
    <AdminSignalsView
      statusParam={params.status}
      vaultParam={params.vault}
    />
  );
}
