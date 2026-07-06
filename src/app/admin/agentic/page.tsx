// Admin · Agentic Console (simplified) — read-only command console.
// Server Component — gated by the admin layout (session.role === "admin").
//
// READ-ONLY: this page renders a pared-down console (agents, tool boundary,
// observability). It executes no tool, creates no confirmation token, performs
// no write, and runs no LLM. The full 8-zone control tower is preserved and
// archived at /admin/agentic/detailed.

import Link from "next/link";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { BENTO_SECONDARY_BTN } from "@/components/catalyst/bento";
import { AgenticConsoleSimple } from "@/components/admin/agentic/agentic-console-simple";
import { getAgenticControlCenterData } from "@/lib/agentic/control-center";
import {
  getRouterObservabilitySummary,
  resolveWindow,
} from "@/lib/agentic/observability/read-router-decisions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agentic Console — Hearst Connect" };

export default async function AgenticConsolePage({
  searchParams,
}: {
  searchParams: Promise<{ routerWindow?: string }>;
}) {
  const controlCenter = getAgenticControlCenterData();

  const sp = await searchParams;
  const routerWindow = resolveWindow(sp.routerWindow);
  const observability = await getRouterObservabilitySummary({
    window: routerWindow,
  }).catch(() => null);

  const observabilityWindow = observability?.window ?? routerWindow;

  return (
    <AdminPageShell
      titleLead="Agentic"
      titleAccent="Console"
      contextLabel={`registry ${controlCenter.version} · read-only`}
      headerActions={
        <Link href="/admin/agentic/detailed" className={BENTO_SECONDARY_BTN}>
          Vue détaillée
        </Link>
      }
    >
      <AgenticConsoleSimple
        controlCenter={controlCenter}
        observability={observability}
        observabilityWindow={observabilityWindow}
      />
    </AdminPageShell>
  );
}
