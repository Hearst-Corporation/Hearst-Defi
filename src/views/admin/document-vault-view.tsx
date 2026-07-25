import { formatAdminDate } from "@/lib/vaults/product-display";
import {
  Badge,
  EmptyState,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

type DocumentRow = {
  id: string;
  title: string;
  type: string;
  project: string | null;
  source: string | null;
  status: string | null;
  slideCount: number | null;
  updatedAt: Date;
};

export function AdminDocumentVaultView({
  documents,
}: {
  documents: DocumentRow[];
}) {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Content"
        title="Document vault"
        description="Read-only browser for documents ingested via the document vault API."
      />

      <Section title="Documents">
        <Panel
          title={`${documents.length} most recent`}
          description="Newest first."
        >
          {documents.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No documents yet"
                description="Documents are created via POST /api/document-vault/documents by an authenticated caller."
              />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="hidden lg:table-cell">Project</TableHead>
                  <TableHead className="text-center">Source</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Slides</TableHead>
                  <TableHead className="text-right">Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell className="font-medium">{doc.title}</TableCell>
                    <TableCell>{doc.type}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {doc.project ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline">{doc.source ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {doc.status ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {doc.slideCount ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatAdminDate(doc.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </Section>
    </PageLayout>
  );
}
