// Admin · Document Vault — read-only browser for DocumentVaultDocument.
// Backend (5 routes under /api/document-vault, 3 Prisma tables) is LIVE in
// prod (69 real documents) but had no admin surface. Server Component, direct
// Prisma read — gated by the admin layout.

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import { Badge } from "@/components/catalyst/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { prisma } from "@/lib/db";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Document Vault — Hearst Connect",
};

export default async function DocumentVaultAdminPage() {
  const documents = await prisma.documentVaultDocument.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
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

  return (
    <AdminPageShell
      titleLead="Document"
      titleAccent="Vault"
      contextLabel="Content"
    >
      <AdminSectionCard
        ariaLabel="Documents"
        title="Documents"
        subtitle={`${documents.length} most recent, newest first`}
      >
        {documents.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No documents yet."
            detail="Documents are created via POST /api/document-vault/documents by an authenticated caller."
            className="min-h-32"
          />
        ) : (
          <Table className={TABLE_WRAP}>
            <TableHead>
              <TableRow>
                <TableHeader className={`${TABLE_HEAD} pl-5`}>Title</TableHeader>
                <TableHeader className={TABLE_HEAD}>Type</TableHeader>
                <TableHeader className={`${TABLE_HEAD} hidden lg:table-cell`}>
                  Project
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-center`}>
                  Source
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-center`}>
                  Status
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} text-center`}>
                  Slides
                </TableHeader>
                <TableHeader className={`${TABLE_HEAD} pr-5 text-right`}>
                  Updated
                </TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id} className={ROW}>
                  <TableCell className="pl-5 font-medium">{doc.title}</TableCell>
                  <TableCell>{doc.type}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {doc.project ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge color="zinc">{doc.source ?? "—"}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {doc.status ?? "—"}
                  </TableCell>
                  <TableCell className="text-center">
                    {doc.slideCount ?? "—"}
                  </TableCell>
                  <TableCell className="pr-5 text-right">
                    {formatAdminDate(doc.updatedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </AdminSectionCard>
    </AdminPageShell>
  );
}
