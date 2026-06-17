// Admin · Campaign detail — meta, agent-draft trigger, and the per-recipient
// emails awaiting review. Server Component — inherits the /admin layout's
// requireAdmin() gate. Email cards are client islands (editable + approve).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { EmailReviewCard } from "@/components/admin/outreach/email-review-card";
import { DraftCampaignButton } from "@/components/admin/outreach/draft-campaign-button";
import { loadCampaignDetail } from "@/lib/data/outreach";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = { title: "Campaign — Hearst Connect" };

/** Campaign status → Badge variant. */
const CAMPAIGN_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "accent"
> = {
  draft: "default",
  review: "warning",
  sending: "accent",
  sent: "success",
};

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const detail = await loadCampaignDetail(campaignId);
  if (!detail) notFound();

  return (
    <div className="admin-doc-shell">
      <AdminPageHeader
        title={detail.name}
        eyebrow={`campaign · ${detail.kind}`}
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
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Campaign">
        <h2 className="h2">Campaign brief</h2>
        <p className="body-xs ct-text-muted">
          Approved campaign inputs and sender context used across the drafting run.
        </p>
        <Card className="p-5" hoverOverlay={false}>
          <dl className="admin-doc-form-grid-2 body-sm">
            <div>
              <dt className="ct-form-label">Kind</dt>
              <dd className="ct-text-body">{detail.kind}</dd>
            </div>
            <div>
              <dt className="ct-form-label">Status</dt>
              <dd className="ct-text-body">{detail.status}</dd>
            </div>
            <div>
              <dt className="ct-form-label">From</dt>
              <dd className="mono ct-text-muted">{detail.fromEmail ?? "default"}</dd>
            </div>
            <div>
              <dt className="ct-form-label">Created</dt>
              <dd className="ct-text-body">{formatAdminDate(detail.createdAt)}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="ct-form-label">Subject template</dt>
              <dd className="ct-text-body">{detail.subjectTemplate ?? "—"}</dd>
            </div>
            <div className="md:col-span-2">
              <dt className="ct-form-label">Base brief</dt>
              <dd className="ct-text-muted whitespace-pre-wrap">
                {detail.bodyTemplate ?? "—"}
              </dd>
            </div>
          </dl>
        </Card>
      </section>

      {/* Draft via agent */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Draft">
        <h2 className="h2">Draft generation</h2>
        <p className="body-xs ct-text-muted">
          Generate one tailored draft per recipient from the approved brief and,
          when enabled, prospect qualification context. Output lands below in the
          review queue and remains unsent until an operator approves each email.
        </p>
        <div className="admin-doc-toolbar">
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <DraftCampaignButton campaignId={detail.id} />
          </div>
        </div>
      </section>

      {/* Emails */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Emails">
        <h2 className="h2">Recipient review queue ({detail.emails.length})</h2>
        {detail.emails.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No recipient drafts available yet."
            detail="Use “Draft with agent” to generate the first reviewable email set for this campaign."
            className="min-h-20"
          />
        ) : (
          <div className="admin-doc-stack admin-doc-stack--actions">
            {detail.emails.map((email) => (
              <EmailReviewCard key={email.id} email={email} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
