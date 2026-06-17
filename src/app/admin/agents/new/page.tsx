// Admin · Agents · New template.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { AgentTemplateForm } from "@/components/admin/agent-template-form";

export const dynamic = "force-dynamic";

export const metadata = { title: "New agent template — Hearst Connect" };

export default function NewAgentTemplatePage() {
  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title="New agent template"
        description="Define a reusable operator profile for investor-facing agent behavior, language, and register."
        lead={
          <Link href="/admin/agents" className="body-xs ct-text-muted hover:ct-text-strong">
            ← Agents
          </Link>
        }
      />
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="New template">
        <Card className="p-5" hoverOverlay={false}>
          <AgentTemplateForm />
        </Card>
      </section>
    </div>
  );
}
