// Admin · Agents · New template.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Card } from "@/components/ui/card";
import { AgentTemplateForm } from "@/components/admin/agent-template-form";
import {
  BASE_AGENTS,
  type BaseAgent,
} from "@/lib/agents/agent-template-constants";

export const dynamic = "force-dynamic";

export const metadata = { title: "New agent template — Hearst Connect" };

export default async function NewAgentTemplatePage({
  searchParams,
}: {
  searchParams: Promise<{ base?: string }>;
}) {
  const { base } = await searchParams;
  // Only honour a base that is actually a known agent — a forged/stale param
  // falls back to the form default, never crashes.
  const initialBaseAgent = BASE_AGENTS.includes(base as BaseAgent)
    ? (base as BaseAgent)
    : undefined;

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
        <Card className="p-[var(--ct-space-6)]" hoverOverlay={false}>
          <AgentTemplateForm initialBaseAgent={initialBaseAgent} />
        </Card>
      </section>
    </div>
  );
}
