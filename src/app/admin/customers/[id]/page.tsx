// Admin · Customer detail — identity, KYC, positions, qualification (Typeform),
// agent calibration, accumulating memory, recent conversations.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { BentoPanel } from "@/components/ui/bento";
import { EmptySurface } from "@/components/ui/empty-surface";
import { KycAction } from "@/components/admin/kyc-action";
import { DeployPositionForm } from "@/components/admin/customer/deploy-position-form";
import { ActivationLinkButton } from "@/components/admin/customer/activation-link-button";
import { QualificationForm } from "@/components/admin/customer/qualification-form";
import { AgentAssignForm } from "@/components/admin/customer/agent-assign-form";
import { MemoryManager } from "@/components/admin/customer/memory-manager";
import { loadCustomerDetail } from "@/lib/data/customer-detail";
import {
  AdminDetailSection,
  AdminDetailGrid,
  AdminDetailItem,
} from "@/components/admin/admin-detail-layout";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { loadActiveTemplates } from "@/lib/data/agent-templates";
import { formatAdminDate, formatUsdFull } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = { title: "Customer — Hearst Connect" };

const POSITION_STATUS_LABEL: Record<string, string> = {
  active: "Active",
  matured: "Matured",
  exited: "Exited",
};

// Human-readable label for QualificationProfile.source. Three writers feed this
// column: the Typeform webhook ("typeform"), the self-serve /apply form
// ("self"), and an admin manual edit ("manual"). Render a friendly label so the
// raw enum (e.g. "self") never shows verbatim in the admin UI.
const QUAL_SOURCE_LABEL: Record<string, string> = {
  typeform: "Typeform intake",
  self: "Self-serve application",
  manual: "Admin entry",
};

// Bento chip chrome — neutral pill used for calibration meta (style/language/
// detail/vault). Accent variant marks the active preset.
const META_CHIP =
  "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300";
const ACCENT_CHIP =
  "inline-flex items-center rounded-full border border-[#A7FB90]/30 bg-[#A7FB90]/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#A7FB90]";

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [detail, templates] = await Promise.all([
    loadCustomerDetail(id),
    loadActiveTemplates(),
  ]);
  if (!detail) notFound();

  const persona = detail.suggestedPersona;
  const applied = detail.agentProfile;

  return (
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          title={detail.email}
          eyebrow={`investor · ${detail.userId}`}
          description="Identity, qualification, assistant settings, saved notes, and recent activity."
          lead={
            <Link
              href="/admin/customers"
              className="text-[12px] text-zinc-500 transition-colors hover:text-white"
            >
              ← Investors
            </Link>
          }
          actions={
            <KycAction
              investorId={detail.investorId}
              status={detail.kycStatus as "pending" | "approved" | "rejected"}
            />
          }
        />

          {/* Identity + positions */}
          <AdminDetailSection label="Identity" title="Investor profile">
            <AdminDetailGrid>
              <AdminDetailItem label="Email">
                <span className="font-medium text-white">{detail.email}</span>
              </AdminDetailItem>
              <AdminDetailItem label="Role">{detail.role}</AdminDetailItem>
              <AdminDetailItem label="Wallet">
                <span className="font-mono text-zinc-500">
                  {detail.walletAddress ?? "—"}
                </span>
              </AdminDetailItem>
              <AdminDetailItem label="Joined">
                {formatAdminDate(detail.joinedAt)}
              </AdminDetailItem>
            </AdminDetailGrid>
            <BentoPanel className="p-5">
              <div className="flex flex-col gap-3">
                <p className="m-0 text-[12px] leading-relaxed text-zinc-500">
                  Account sign-in. Auto-created and admin-provisioned investors start
                  with no usable password — they log in via a one-time activation
                  link. Generate a fresh link here if the welcome email never reached
                  them.
                </p>
                <ActivationLinkButton investorId={detail.investorId} />
              </div>
            </BentoPanel>
          </AdminDetailSection>

          <AdminDetailSection label="Positions" title={`Vault positions (${detail.positions.length})`}>
            {detail.positions.length === 0 ? (
              <EmptySurface
                variant="widget"
                message="No positions on record."
                detail="This investor has not yet subscribed to a vault position."
                className="min-h-20"
              />
            ) : (
              <AdminTable
                data={detail.positions}
                headers={["Vault", "Status", <span key="principal" className="text-right">Principal</span>, <span key="subscribed" className="text-right">Subscribed</span>]}
                colWidths={["40%", "25%", "20%", "15%"]}
                renderRow={(p) => (
                  <>
                    <td className="px-5 py-3 font-mono text-[13px] text-zinc-300">
                      {p.vaultKey}
                    </td>
                    <td className="px-5 py-3 text-[13px] text-zinc-500">
                      {POSITION_STATUS_LABEL[p.status] ?? p.status}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] font-medium tabular-nums text-white">
                      {formatUsdFull(p.principalUsdc)}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-zinc-500">
                      {formatAdminDate(p.subscribedAt)}
                    </td>
                  </>
                )}
              />
            )}
          </AdminDetailSection>

          {/* Deploy position */}
          <AdminDetailSection
            label="Deploy position"
            title="Deploy position"
            description="Open an off-chain position for this investor — fills the cockpit for demo or pilot use without requiring a real on-chain deposit. KYC must be approved first."
          >
            <BentoPanel className="p-6">
              <DeployPositionForm
                investorId={detail.investorId}
                kycStatus={detail.kycStatus as "pending" | "approved" | "rejected"}
              />
            </BentoPanel>
          </AdminDetailSection>

          {/* Qualification (Typeform) */}
          <AdminDetailSection
            label="Qualification"
            title="Investor qualification"
            description={
              detail.qualification
                ? `Source: ${QUAL_SOURCE_LABEL[detail.qualification.source] ?? detail.qualification.source} · updated ${formatAdminDate(detail.qualification.updatedAt)}`
                : "No qualification profile on file yet. Complete the intake questionnaire to tailor the assistant for this investor."
            }
          >
            <BentoPanel className="p-6">
              <QualificationForm
                investorId={detail.investorId}
                userId={detail.userId}
                profile={detail.qualification}
              />
            </BentoPanel>
          </AdminDetailSection>

          {/* Agent calibration */}
          <AdminDetailSection label="Agent" title="Assistant settings">
            {persona && (
              <BentoPanel className="p-6">
                <div className="flex flex-col gap-4">
                  <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white">
                    Recommended
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {persona.segments.map((s) => (
                      <span key={s} className={ACCENT_CHIP}>
                        {s}
                      </span>
                    ))}
                    <span className={META_CHIP}>Style: {persona.tone}</span>
                    <span className={META_CHIP}>Language: {persona.language}</span>
                    <span className={META_CHIP}>Detail: {persona.verbosity}</span>
                    <span className={META_CHIP}>vault: {persona.suggestedVault}</span>
                  </div>
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    {persona.customInstructions}
                  </p>
                </div>
              </BentoPanel>
            )}

            <BentoPanel className="p-6">
              <div className="flex flex-col gap-4">
                <h3 className="text-[13px] font-semibold uppercase tracking-wider text-white">
                  Current
                </h3>
                {applied ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {applied.template && (
                      <span className={ACCENT_CHIP}>Preset: {applied.template.label}</span>
                    )}
                    <span className={META_CHIP}>Style: {applied.tone ?? "—"}</span>
                    <span className={META_CHIP}>Language: {applied.language ?? "—"}</span>
                    <span className={META_CHIP}>Detail: {applied.verbosity ?? "—"}</span>
                  </div>
                ) : (
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    No profile is applied yet. Refresh from intake answers or assign a reusable template.
                  </p>
                )}
                {applied?.customInstructions && (
                  <p className="text-[13px] leading-relaxed text-zinc-400">
                    {applied.customInstructions}
                  </p>
                )}
                <AgentAssignForm
                  investorId={detail.investorId}
                  userId={detail.userId}
                  templates={templates}
                  currentTemplateId={applied?.templateId ?? null}
                  currentTemplate={applied?.template ?? null}
                  canRecalibrate={detail.qualification !== null}
                />
              </div>
            </BentoPanel>
          </AdminDetailSection>

          {/* Memory */}
          <AdminDetailSection
            label="Memory"
            title="Saved notes"
            description="Persistent context and notes for this investor."
          >
            <BentoPanel className="p-6">
              <MemoryManager
                investorId={detail.investorId}
                userId={detail.userId}
                memory={detail.memory}
              />
            </BentoPanel>
          </AdminDetailSection>

          {/* Recent conversations */}
          <AdminDetailSection
            label="Conversations"
            title={`Recent chat activity (${detail.chats.length})`}
          >
            {detail.chats.length === 0 ? (
              <EmptySurface
                variant="widget"
                message="No chat activity yet."
                detail="Investor conversations will appear here once a session has been opened."
                className="min-h-20"
              />
            ) : (
              <AdminTable
                data={detail.chats}
                headers={["Title", <span key="messages" className="text-right">Messages</span>, <span key="updated" className="text-right">Updated</span>]}
                colWidths={["50%", "25%", "25%"]}
                renderRow={(c) => (
                  <>
                    <td className="px-5 py-3 truncate text-[13px] text-zinc-300">
                      {c.title ?? "(untitled)"}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] tabular-nums text-zinc-500">
                      {c.messageCount}
                    </td>
                    <td className="px-5 py-3 text-right text-[13px] text-zinc-500">
                      {formatAdminDate(c.updatedAt)}
                    </td>
                  </>
                )}
              />
            )}
          </AdminDetailSection>
        </div>
      </div>
  );
}
