// Admin · Agents · New template.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AgentTemplateForm } from "@/components/admin/agent-template-form";
import { BentoPanel } from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="New agent"
          titleAccent="template"
          contextLabel="Agent Operations"
          description="Define a reusable operator profile for investor-facing agent behavior, language, and register."
          lead={
            <Link
              href="/admin/agents"
              className="text-[12px] text-zinc-500 hover:text-white"
            >
              ← Agents
            </Link>
          }
        />
        <BentoPanel aria-label="New template">
          <div className="p-5 lg:p-6">
            <AgentTemplateForm initialBaseAgent={initialBaseAgent} />
          </div>
        </BentoPanel>
      </div>
    </div>
  );
}
