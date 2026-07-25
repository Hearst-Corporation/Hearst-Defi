import { prisma } from "@/lib/db";
import {
  AdminDocumentVaultView,
  DOCUMENT_VAULT_TAKE,
} from "@/views/admin/document-vault-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Document Vault — Hearst Connect",
};

export default async function DocumentVaultAdminPage() {
  const documents = await prisma.documentVaultDocument.findMany({
    orderBy: { updatedAt: "desc" },
    take: DOCUMENT_VAULT_TAKE,
    select: {
      id: true,
      title: true,
      type: true,
      project: true,
      source: true,
      status: true,
      slideCount: true,
      updatedAt: true,
    },
  });

  return <AdminDocumentVaultView documents={documents} />;
}
