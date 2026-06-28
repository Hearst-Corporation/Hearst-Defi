// Admin · Agents · Edit template.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { AgentTemplateForm } from "@/components/admin/agent-template-form";
import { BentoPanel } from "@/components/ui/bento";
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
    <AdminPageShell
      titleLead="Edit agent"
      titleAccent="template"
      contextLabel={template.label}
      description="Review and refine the reusable profile applied to investor-facing agent experiences."
      lead={
        <Link
          href="/admin/agents"
          className="ct-metric-caption hover:text-[var(--ct-text-strong)]"
        >
          ← Agents
        </Link>
      }
    >
      <BentoPanel aria-label="Edit template">
        <div className="p-5 lg:p-6">
          <AgentTemplateForm template={template} />
        </div>
      </BentoPanel>
    </AdminPageShell>
  );
}
