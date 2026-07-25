import { notFound } from "next/navigation";

import { loadVaultDetail } from "./_data/vault-detail-loader";
import { VaultDetailView } from "@/views/investor/vault-detail-view";
import {
  SERIES1_DESCRIPTION,
  SERIES1_FULL_NAME,
} from "@/lib/vaults/series1";

export const dynamic = "force-dynamic";

export const metadata = {
  title: `Vault details · ${SERIES1_FULL_NAME}`,
  description: SERIES1_DESCRIPTION,
};

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VaultDetailPage({ params }: PageProps) {
  const { id } = await params;
  const data = await loadVaultDetail(id);
  if (!data.vault) notFound();
  return <VaultDetailView {...data} />;
}
