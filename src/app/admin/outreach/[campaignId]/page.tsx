// Admin · Campaign detail — meta, agent-draft trigger, and the per-recipient
// emails awaiting review. Server Component — gated by admin layout (session.role).
// Email cards are client islands (editable + approve).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { EmptySurface } from "@/components/ui/empty-surface";
import { EmailReviewCard } from "@/components/admin/outreach/email-review-card";
import { DraftCampaignButton } from "@/components/admin/outreach/draft-campaign-button";
import { SendCampaignButton } from "@/components/admin/outreach/send-campaign-button";
import { BentoPanel } from "@/components/ui/bento";
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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Campaign"
          titleAccent={detail.name}
          contextLabel={`Outreach · ${detail.kind}`}
          description="Review the campaign mandate, generate tailored drafts, and clear each recipient email before release."
          lead={
            <Link
              href="/admin/outreach"
              className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
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
              <span className="font-mono text-[var(--ct-text-body)]">{detail.fromEmail ?? "default"}</span>
            </AdminDetailItem>
            <AdminDetailItem label="Created">{formatAdminDate(detail.createdAt)}</AdminDetailItem>
            <AdminDetailItem label="Subject template" fullWidth>
              {detail.subjectTemplate ?? "—"}
            </AdminDetailItem>
            <AdminDetailItem label="Base brief" fullWidth>
              <span className="whitespace-pre-wrap text-[var(--ct-text-body)]">
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
          <div className="flex flex-wrap items-center gap-2">
            <DraftCampaignButton campaignId={detail.id} />
          </div>
        </AdminDetailSection>

        {/* Delivery summary — visible once emails start being dispatched */}
        {deliverySummary && (
          <AdminDetailSection label="Delivery summary" title="Delivery">
            <BentoPanel className="p-6">
              <p className="ct-metric-value font-mono">{deliverySummary}</p>
            </BentoPanel>
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
                <span className="font-mono">sending</span> and Inngest fans out delivery
                over each approved recipient.
              </>
            }
          >
            <div className="flex flex-wrap items-center gap-2">
              <SendCampaignButton
                campaignId={detail.id}
                approvedCount={approvedCount}
              />
            </div>
          </AdminDetailSection>
        )}

        {/* Emails */}
        <section className="flex flex-col gap-4" aria-label="Emails">
          <h2 className="ct-section-title">
            Recipient review queue ({detail.emails.length})
          </h2>
          {detail.emails.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No recipient drafts available yet."
              detail={'Use “Draft with agent” to generate the first reviewable email set for this campaign.'}
              className="min-h-20"
            />
          ) : (
            <div className="flex flex-col gap-4">
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
      </div>
    </div>
  );
}
