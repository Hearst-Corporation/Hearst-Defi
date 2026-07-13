// Admin · Agents — placeholder.
//
// The agent orchestration system is no longer managed from this platform: the
// former in-app Agentic Console, Agent Library and Model Bench were removed
// (their code is gone, not hidden). Agents are being rebuilt on an external
// platform and will be pushed back into this slot. Until then this route is an
// honest placeholder — no fake agents, no invented metrics, no mock runs.
//
// Server Component — gated by the admin layout (session.role).

import { AdminPageShell, AdminSectionCard } from "@/components/admin/admin-page-shell";
import { EmptySurface } from "@/components/catalyst/empty-surface";

export const dynamic = "force-dynamic";

export const metadata = { title: "Agents — Hearst Connect" };

export default function AgenticPlaceholderPage() {
  return (
    <AdminPageShell
      title="Agents"
      description="Agent orchestration now runs on an external platform. This is the slot where it will be re-integrated."
    >
      <AdminSectionCard title="Not managed here">
        <EmptySurface
          message="Agent orchestration has moved off this platform."
          detail="The in-app agent console, library and model bench were removed. Agents are rebuilt externally and will be pushed back into this slot — nothing runs from here yet."
        />
      </AdminSectionCard>
    </AdminPageShell>
  );
}
