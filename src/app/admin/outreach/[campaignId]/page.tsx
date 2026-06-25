// Admin · Campaign detail — meta, agent-draft trigger, and the per-recipient
// emails awaiting review. Server Component — gated by admin layout (session.role).
// Email cards are client islands (editable + approve).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { EmailReviewCard } from "@/components/admin/outreach/email-review-card";
import { DraftCampaignButton } from "@/components/admin/outreach/draft-campaign-button";
import { SendCampaignButton } from "@/components/admin/outreach/send-campaign-button";
import { loadCampaignDetail } from "@/lib/data/outreach";
import {
  AdminDetailSection,
  AdminDetailGrid,
  AdminDetailItem,
} from "@/components/admin/admin-detail-layout";
import { formatAdminDate } from "@/lib/vaults/product-display";
import { CAMPAIGN_VARIANT } from "@/lib/outreach/status-variants";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaign — Hearst Connect" };

/** Returns a tidy funnel summary string, e.g. "12 sent · 9 delivered · 4 opened · 1 bounced". */
function buildDeliverySummary(statusCounts: Record<string, number>): string | null {
  const parts: string[] = [];
  const add = (key: string, label: string) => {
    const n = statusCounts[key] ?? 0;
    if (n > 0) parts.push(`${n} ${label}`);
  };
  add("sent", "sent");
  add("delivered", "delivered");
  add("opened", "opened");
  add("clicked", "clicked");
  add("bounced", "bounced");
  add("failed", "failed");
  return parts.length > 0 ? parts.join(" · ") : null;
}

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const detail = await loadCampaignDetail(campaignId);
  if (!detail) notFound();

  const approvedCount = detail.statusCounts["approved"] ?? 0;
  const canRelease =
    (detail.status === "draft" || detail.status === "review") && approvedCount > 0;
  const deliverySummary = buildDeliverySummary(detail.statusCounts);

  return (
    <>
      <AdminPageHeader
        titleLead="Campaign"
        titleAccent={detail.name}
        contextLabel={`Outreach · ${detail.kind}`}
        description="Review the campaign mandate, generate tailored drafts, and clear each recipient email before release."
        lead={
          <Link
            href="/admin/outreach"
            className="body-xs ct-text-muted hover:ct-text-strong"
          >
            ← Outreach
          </Link>
        }
        actions={
          <Badge variant={CAMPAIGN_VARIANT[detail.status] ?? "default"}>
            {detail.status}
          </Badge>
        }
      />

      {/* Meta */}
      <AdminDetailSection
        label="Campaign"
        title="Campaign brief"
        description="Approved campaign inputs and sender context used across the drafting run."
      >
        <AdminDetailGrid>
          <AdminDetailItem label="Kind">{detail.kind}</AdminDetailItem>
          <AdminDetailItem label="Status">{detail.status}</AdminDetailItem>
          <AdminDetailItem label="From">
            <span className="mono ct-text-muted">{detail.fromEmail ?? "default"}</span>
          </AdminDetailItem>
          <AdminDetailItem label="Created">{formatAdminDate(detail.createdAt)}</AdminDetailItem>
          <AdminDetailItem label="Subject template" fullWidth>
            {detail.subjectTemplate ?? "—"}
          </AdminDetailItem>
          <AdminDetailItem label="Base brief" fullWidth>
            <span className="ct-text-muted whitespace-pre-wrap">
              {detail.bodyTemplate ?? "—"}
            </span>
          </AdminDetailItem>
        </AdminDetailGrid>
      </AdminDetailSection>

      {/* Draft via agent */}
      <AdminDetailSection
        label="Draft"
        title="Draft generation"
        description="Generate one tailored draft per recipient from the approved brief and, when enabled, prospect qualification context. Output lands below in the review queue and remains unsent until an operator approves each email."
      >
        <div className="admin-doc-toolbar">
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <DraftCampaignButton campaignId={detail.id} />
          </div>
        </div>
      </AdminDetailSection>

      {/* Delivery summary — visible once emails start being dispatched */}
      {deliverySummary && (
        <AdminDetailSection label="Delivery summary" title="Delivery">
          <Card className="p-[var(--ct-space-6)]" hoverOverlay={false}>
            <p className="body-sm ct-text-muted mono">{deliverySummary}</p>
          </Card>
        </AdminDetailSection>
      )}

      {/* Release — shown only when campaign is sendable (draft|review + ≥1 approved email) */}
      {canRelease && (
        <AdminDetailSection
          label="Release"
          title="Release"
          description={
            <>
              Dispatch all approved emails. The campaign switches to{" "}
              <span className="mono">sending</span> and Inngest fans out delivery
              over each approved recipient.
            </>
          }
        >
          <div className="admin-doc-toolbar">
            <div className="admin-doc-inline-row admin-doc-inline-row--actions">
              <SendCampaignButton
                campaignId={detail.id}
                approvedCount={approvedCount}
              />
            </div>
          </div>
        </AdminDetailSection>
      )}

      {/* Emails */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Emails">
        <h2 className="h2">Recipient review queue ({detail.emails.length})</h2>
        {detail.emails.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No recipient drafts available yet."
            detail={'Use “Draft with agent” to generate the first reviewable email set for this campaign.'}
            className="min-h-20"
          />
        ) : (
          <div className="admin-doc-stack admin-doc-stack--actions">
            {detail.emails.map((email) => (
              <EmailReviewCard
                key={email.id}
                email={{
                  id: email.id,
                  toEmail: email.toEmail,
                  subject: email.subject,
                  body: email.body,
                  status: email.status,
                  draftedByAgent: email.draftedByAgent,
                  latestEventType: email.latestEventType,
                  latestEventAt: email.latestEventAt,
                }}
              />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
