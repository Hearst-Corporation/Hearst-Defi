// Admin · Agents · Edit template.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AgentTemplateForm } from "@/components/admin/agent-template-form";
import { loadAgentTemplate } from "@/lib/data/agent-templates";

export const dynamic = "force-dynamic";

export const metadata = { title: "Edit agent template — Hearst Connect" };

export default async function EditAgentTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const template = await loadAgentTemplate(id);
  if (!template) notFound();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title={template.label}
        eyebrow="Agent template"
        description="Review and refine the reusable profile applied to investor-facing agent experiences."
        lead={
          <Link href="/admin/agents" className="body-xs ct-text-muted hover:ct-text-strong">
            ← Agents
          </Link>
        }
        actions={template.archived ? <Badge variant="warning">Archived</Badge> : undefined}
      />
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Edit template">
        <Card className="p-5" hoverOverlay={false}>
          <AgentTemplateForm template={template} />
        </Card>
      </section>
    </div>
  );
}
