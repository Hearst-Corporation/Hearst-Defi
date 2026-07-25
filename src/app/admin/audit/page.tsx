import { getAdminAuditLog } from "@/lib/admin/audit";
import { AdminAuditView } from "@/views/admin/audit-view";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Audit Log — Hearst Connect",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<{
    entityType?: string;
    actor?: string;
    action?: string;
  }>;
}) {
  const { entityType, actor, action } = await searchParams;

  const entries = await getAdminAuditLog({
    entityType: entityType?.trim() || undefined,
    actorWallet: actor?.trim() || undefined,
    action: action?.trim() || undefined,
  });

  return (
    <AdminAuditView
      entries={entries}
      filters={{ entityType, actor, action }}
    />
  );
}
