// Admin · Customer detail — identity, KYC, positions, qualification (Typeform),
// agent calibration, accumulating memory, recent conversations.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageShell } from "@/components/admin/admin-page-shell";
import { Badge } from "@/components/catalyst/badge";
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

// Calibration meta uses the Catalyst <Badge> primitive (zinc = neutral meta,
// green = active preset/segment) — the two local chip recipes that recreated a
// badge with hardcoded #A7FB90 / border-white / text-zinc were removed.

// Tokenized table-cell classes (canon roles) — no inline text-[Npx]/text-zinc-*.
const CELL = "px-5 py-3 ct-metric-caption";
const CELL_STRONG = "px-5 py-3 ct-metric-value";

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
    <AdminPageShell
      title={detail.email}
      eyebrow={`investor · ${detail.userId}`}
      description="Identity, qualification, assistant settings, saved notes, and recent activity."
      lead={
        <Link
          href="/admin/customers"
          className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
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
    >

          {/* Identity + positions */}
          <AdminDetailSection label="Identity" title="Investor profile">
            <AdminDetailGrid>
              <AdminDetailItem label="Email">
                <span className="font-medium text-[var(--ct-text-strong)]">
                  {detail.email}
                </span>
              </AdminDetailItem>
              <AdminDetailItem label="Role">{detail.role}</AdminDetailItem>
              <AdminDetailItem label="Wallet">
                <span className="font-mono text-[var(--ct-text-muted)]">
                  {detail.walletAddress ?? "—"}
                </span>
              </AdminDetailItem>
              <AdminDetailItem label="Joined">
                {formatAdminDate(detail.joinedAt)}
              </AdminDetailItem>
            </AdminDetailGrid>
            <BentoPanel className="p-5">
              <div className="flex flex-col gap-3">
                <p className="ct-metric-caption m-0 leading-relaxed">
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
                    <td className={`${CELL} font-mono text-[var(--ct-text-body)]`}>
                      {p.vaultKey}
                    </td>
                    <td className={CELL}>
                      {POSITION_STATUS_LABEL[p.status] ?? p.status}
                    </td>
                    <td className={`${CELL_STRONG} text-right`}>
                      {formatUsdFull(p.principalUsdc)}
                    </td>
                    <td className={`${CELL} text-right`}>
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
                  <h3 className="ct-bento-label">Recommended</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    {persona.segments.map((s) => (
                      <Badge key={s} color="green" className="uppercase">
                        {s}
                      </Badge>
                    ))}
                    <Badge color="zinc">Style: {persona.tone}</Badge>
                    <Badge color="zinc">Language: {persona.language}</Badge>
                    <Badge color="zinc">Detail: {persona.verbosity}</Badge>
                    <Badge color="zinc">vault: {persona.suggestedVault}</Badge>
                  </div>
                  <p className="ct-metric-caption leading-relaxed">
                    {persona.customInstructions}
                  </p>
                </div>
              </BentoPanel>
            )}

            <BentoPanel className="p-6">
              <div className="flex flex-col gap-4">
                <h3 className="ct-bento-label">Current</h3>
                {applied ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {applied.template && (
                      <Badge color="green" className="uppercase">
                        Preset: {applied.template.label}
                      </Badge>
                    )}
                    <Badge color="zinc">Style: {applied.tone ?? "—"}</Badge>
                    <Badge color="zinc">Language: {applied.language ?? "—"}</Badge>
                    <Badge color="zinc">Detail: {applied.verbosity ?? "—"}</Badge>
                  </div>
                ) : (
                  <p className="ct-metric-caption leading-relaxed">
                    No profile is applied yet. Refresh from intake answers or assign a reusable template.
                  </p>
                )}
                {applied?.customInstructions && (
                  <p className="ct-metric-caption leading-relaxed">
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
                    <td className={`${CELL} truncate text-[var(--ct-text-body)]`}>
                      {c.title ?? "(untitled)"}
                    </td>
                    <td className={`${CELL} text-right tabular-nums`}>
                      {c.messageCount}
                    </td>
                    <td className={`${CELL} text-right`}>
                      {formatAdminDate(c.updatedAt)}
                    </td>
                  </>
                )}
              />
            )}
          </AdminDetailSection>
    </AdminPageShell>
  );
}
