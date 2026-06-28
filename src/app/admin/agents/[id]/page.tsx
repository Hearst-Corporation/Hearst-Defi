// Admin · Agents · Edit template.

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Edit agent"
          titleAccent="template"
          contextLabel={template.label}
          description="Review and refine the reusable profile applied to investor-facing agent experiences."
          lead={
            <Link
              href="/admin/agents"
              className="text-[12px] text-zinc-500 hover:text-white"
            >
              ← Agents
            </Link>
          }
        />
        <BentoPanel aria-label="Edit template">
          <div className="p-5 lg:p-6">
            <AgentTemplateForm template={template} />
          </div>
        </BentoPanel>
      </div>
    </div>
  );
}
