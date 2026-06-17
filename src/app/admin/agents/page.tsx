// Admin · Agents — reusable agent persona templates (the library).
// Server Component — inherits the /admin layout's requireAdmin() gate.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { loadAgentTemplates } from "@/lib/data/agent-templates";
import { ArchiveTemplateButton } from "@/components/admin/archive-template-button";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agents — Hearst Connect" };

export default async function AgentsPage() {
  const templates = await loadAgentTemplates();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Agents"
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/agents/new">New template</Link>
          </Button>
        }
      />

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Agent templates">
        <h2 className="h2">Persona library ({templates.length})</h2>
        <p className="body-xs ct-text-muted">
          Reusable personas layered on the 5 code agents. A customer&apos;s agent
          can inherit a template; per-customer overrides still win.
        </p>

        {templates.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No agent templates yet."
            detail="Create a template to reuse a persona (tone, language, register) across customers."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[28%] stat-label ct-table-header whitespace-nowrap">Label</th>
                    <th className="hidden w-[20%] stat-label ct-table-header whitespace-nowrap md:table-cell">Base agent</th>
                    <th className="hidden w-[22%] stat-label ct-table-header whitespace-nowrap lg:table-cell">Register</th>
                    <th className="w-[12%] stat-label ct-table-header whitespace-nowrap text-right">Used by</th>
                    <th className="w-[18%] stat-label ct-table-header whitespace-nowrap text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {templates.map((t) => (
                    <tr key={t.id} className="border-b border-(--ct-border-soft) last:border-0">
                      <td className="ct-table-cell ct-text-strong">
                        <div className="admin-doc-inline-row">
                          <Link href={`/admin/agents/${t.id}`} className="hover:underline">
                            {t.label}
                          </Link>
                          {t.archived && <Badge variant="warning">Archived</Badge>}
                        </div>
                        {t.description && (
                          <p className="body-xs ct-text-muted truncate">{t.description}</p>
                        )}
                      </td>
                      <td className="hidden ct-table-cell mono ct-text-muted md:table-cell">{t.baseAgent}</td>
                      <td className="hidden ct-table-cell ct-text-body lg:table-cell">
                        {[t.tone, t.language, t.verbosity].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="ct-table-cell text-right tabular-nums ct-text-body">{t.usageCount}</td>
                      <td className="ct-table-cell text-right">
                        <div className="admin-doc-inline-row justify-end">
                          <Button asChild size="sm" variant="ghost">
                            <Link href={`/admin/agents/${t.id}`}>Edit</Link>
                          </Button>
                          <ArchiveTemplateButton id={t.id} archived={t.archived} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
