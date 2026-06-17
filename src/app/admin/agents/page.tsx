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
import { groupCatalogByScope } from "@/lib/agents/agent-catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agents — Hearst Connect" };

export default async function AgentsPage() {
  const templates = await loadAgentTemplates();
  const catalogGroups = groupCatalogByScope();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="Agents"
        description="Govern reusable agent templates and review the base execution surfaces they can inherit."
        actions={
          <Button asChild variant="primary">
            <Link href="/admin/agents/new">New template</Link>
          </Button>
        }
      />

      <section className="admin-doc-stack" aria-label="Agent catalog">
        <h2 className="h2">Base agent catalog</h2>
        <p className="body-xs ct-text-muted">
          Core execution surfaces, grouped by operating scope. These stay wired
          in code; templates below shape tone and behavior on top of them.
        </p>

        <div className="admin-doc-form-grid-2">
          {catalogGroups.map((group) => (
            <Card key={group.scope} hoverOverlay={false}>
              <div className="admin-doc-inline-row mb-3">
                <h3 className="h3">{group.scopeLabel}</h3>
                <Badge variant={group.scope === "platform" ? "accent" : "default"}>
                  {group.entries.length}
                </Badge>
              </div>
              <ul className="flex flex-col gap-3">
                {group.entries.map((entry) => (
                  <li
                    key={entry.baseAgent}
                    className="flex flex-col gap-1 border-b border-(--ct-border-soft) pb-3 last:border-0 last:pb-0"
                  >
                    <div className="admin-doc-inline-row">
                      <span className="body-sm ct-text-strong">{entry.label}</span>
                      <Badge
                        variant={entry.scope === "platform" ? "accent" : "default"}
                      >
                        {entry.scopeLabel}
                      </Badge>
                    </div>
                    <span className="body-xs ct-text-muted">{entry.surface}</span>
                    <span className="body-xs ct-text-muted">{entry.description}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </section>

      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Agent templates">
        <h2 className="h2">Template library ({templates.length})</h2>
        <p className="body-xs ct-text-muted">
          Reusable operator profiles that can be assigned across investor
          accounts. Customer-level overrides still take precedence when set.
        </p>

        {templates.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No templates configured yet."
            detail="Create a reusable profile to standardize tone, language, and register across assigned accounts."
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
