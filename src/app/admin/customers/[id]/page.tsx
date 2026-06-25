// Admin · Customer detail — identity, KYC, positions, qualification (Typeform),
// agent calibration, accumulating memory, recent conversations.
// Server Component — gated by admin layout (session.role).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
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
    <>
      <AdminPageHeader
        title={detail.email}
        eyebrow={`investor · ${detail.userId}`}
        description="Identity, qualification, assistant settings, saved notes, and recent activity."
        lead={
          <Link href="/admin/customers" className="body-xs ct-text-muted hover:ct-text-strong">
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
            <span className="ct-text-strong">{detail.email}</span>
          </AdminDetailItem>
          <AdminDetailItem label="Role">{detail.role}</AdminDetailItem>
          <AdminDetailItem label="Wallet">
            <span className="mono ct-text-muted">{detail.walletAddress ?? "—"}</span>
          </AdminDetailItem>
          <AdminDetailItem label="Joined">{formatAdminDate(detail.joinedAt)}</AdminDetailItem>
        </AdminDetailGrid>
        <div className="admin-doc-stack admin-doc-stack--tight border-t border-(--ct-border-soft) pt-(--ct-space-4) mt-(--ct-space-4)">
          <p className="body-xs ct-text-muted m-0">
            Account sign-in. Auto-created and admin-provisioned investors start
            with no usable password — they log in via a one-time activation
            link. Generate a fresh link here if the welcome email never reached
            them.
          </p>
          <ActivationLinkButton investorId={detail.investorId} />
        </div>
      </AdminDetailSection>

      <AdminDetailSection label="Positions">
        <h3 className="h3">Vault positions ({detail.positions.length})</h3>
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
                <td className="ct-table-cell mono ct-text-body">{p.vaultKey}</td>
                <td className="ct-table-cell ct-text-muted">
                  {POSITION_STATUS_LABEL[p.status] ?? p.status}
                </td>
                <td className="ct-table-cell text-right tabular-nums ct-text-strong">
                  {formatUsdFull(p.principalUsdc)}
                </td>
                <td className="ct-table-cell text-right ct-text-muted">
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
        description="Open an off-chain position for this investor — fills the cockpit for demo or pilot use without requiring a real on-chain deposit. KYC must be approved first."
      >
        <h3 className="h3">Deploy position</h3>
        <Card className="p-(--ct-space-6)" hoverOverlay={false}>
          <DeployPositionForm
            investorId={detail.investorId}
            kycStatus={detail.kycStatus as "pending" | "approved" | "rejected"}
          />
        </Card>
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
        <Card className="p-(--ct-space-6)" hoverOverlay={false}>
          <QualificationForm
            investorId={detail.investorId}
            userId={detail.userId}
            profile={detail.qualification}
          />
        </Card>
      </AdminDetailSection>

      {/* Agent calibration */}
      <AdminDetailSection label="Agent" title="Assistant settings">
        {persona && (
          <Card className="p-(--ct-space-6)" hoverOverlay={false}>
            <div className="admin-doc-stack admin-doc-stack--compact">
              <h3 className="h3">Recommended</h3>
              <div className="admin-doc-inline-row flex-wrap">
                {persona.segments.map((s) => (
                  <Badge key={s} variant="accent">{s}</Badge>
                ))}
                <Badge variant="flat">Style: {persona.tone}</Badge>
                <Badge variant="flat">Language: {persona.language}</Badge>
                <Badge variant="flat">Detail: {persona.verbosity}</Badge>
                <Badge variant="flat">vault: {persona.suggestedVault}</Badge>
              </div>
              <p className="body-sm ct-text-muted">{persona.customInstructions}</p>
            </div>
          </Card>
        )}

        <Card className="p-(--ct-space-6)" hoverOverlay={false}>
          <div className="admin-doc-stack admin-doc-stack--compact">
            <h3 className="h3">Current</h3>
            {applied ? (
              <div className="admin-doc-inline-row flex-wrap">
                {applied.template && <Badge variant="brand">Preset: {applied.template.label}</Badge>}
                <Badge variant="flat">Style: {applied.tone ?? "—"}</Badge>
                <Badge variant="flat">Language: {applied.language ?? "—"}</Badge>
                <Badge variant="flat">Detail: {applied.verbosity ?? "—"}</Badge>
              </div>
            ) : (
              <p className="body-sm ct-text-muted">
                No profile is applied yet. Refresh from intake answers or assign a reusable template.
              </p>
            )}
            {applied?.customInstructions && (
              <p className="body-sm ct-text-muted">{applied.customInstructions}</p>
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
        </Card>
      </AdminDetailSection>

      {/* Memory */}
      <AdminDetailSection
        label="Memory"
        title="Saved notes"
        description="Persistent context and notes for this investor."
      >
        <Card className="p-(--ct-space-6)" hoverOverlay={false}>
          <MemoryManager
            investorId={detail.investorId}
            userId={detail.userId}
            memory={detail.memory}
          />
        </Card>
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
                <td className="ct-table-cell ct-text-body truncate">{c.title ?? "(untitled)"}</td>
                <td className="ct-table-cell text-right tabular-nums ct-text-muted">{c.messageCount}</td>
                <td className="ct-table-cell text-right ct-text-muted">{formatAdminDate(c.updatedAt)}</td>
              </>
            )}
          />
        )}
      </AdminDetailSection>
    </>
  );
}
