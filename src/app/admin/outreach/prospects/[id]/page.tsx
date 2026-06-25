// Admin · Prospect detail — the CRM sheet for a single outreach prospect.
// Server Component — gated by the admin layout (session.role). Pure display:
// identity + the Apollo enrichment snapshot + scoring/tier + the full
// engagement record (emails sent, inbound replies). No writes here; the table
// in /admin/outreach links each prospect to this page (drill-down, dedicated
// page per the no-scroll direction — not a slide-over).

import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { loadProspectDetail } from "@/lib/data/outreach";
import {
  AdminDetailSection,
  AdminDetailGrid,
  AdminDetailItem,
} from "@/components/admin/admin-detail-layout";
import { AdminTable } from "@/components/admin/admin-table-layout";
import { lifecycleFor, type LifecycleKind } from "@/lib/outreach/lifecycle";
import { getMailboxReadiness } from "@/lib/outreach/mailbox-readiness";
import {
  PROSPECT_VARIANT,
  TIER_VARIANT,
} from "@/lib/outreach/status-variants";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = { title: "Prospect — Hearst Connect" };

/** Apollo email verification → Badge variant. */
const EMAIL_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger"
> = {
  verified: "success",
  guessed: "warning",
  unavailable: "danger",
};

/** Lifecycle outcome family → Badge variant. */
const LIFECYCLE_KIND_VARIANT: Record<
  LifecycleKind,
  "default" | "success" | "warning" | "accent"
> = {
  pending: "default",
  active: "accent",
  won: "success",
  lost: "warning",
};

/** Reply intent → Badge variant. */
const INTENT_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "accent"
> = {
  interested: "success",
  question: "accent",
  not_now: "warning",
  unsubscribe: "danger",
  bounce: "danger",
  auto_reply: "default",
  other: "default",
};

/** Keys already surfaced as first-class rows — skipped in the raw Apollo dump. */
const APOLLO_SHOWN_KEYS = new Set([
  "id",
  "firstName",
  "lastName",
  "email",
  "emailStatus",
  "title",
  "linkedinUrl",
  "organizationName",
  "organizationDomain",
  "organizationIndustry",
  "mock",
]);

/** Humanise a camelCase / snake_case Apollo key for display. */
function humaniseKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

/** Render only scalar extra fields from the raw Apollo snapshot. */
function extraApolloRows(
  data: Record<string, unknown> | null,
): Array<{ key: string; value: string }> {
  if (!data) return [];
  const rows: Array<{ key: string; value: string }> = [];
  for (const [key, value] of Object.entries(data)) {
    if (APOLLO_SHOWN_KEYS.has(key)) continue;
    if (value == null) continue;
    if (typeof value === "object") continue; // skip nested objects/arrays
    rows.push({ key: humaniseKey(key), value: String(value) });
  }
  return rows;
}

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const p = await loadProspectDetail(id);
  if (!p) notFound();

  const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
  const displayName = fullName || p.email;
  const isApolloSourced = p.source === "apollo" || p.apolloId != null;
  const extraRows = extraApolloRows(p.apolloData);
  const stage = lifecycleFor(p.status);
  // Global sending posture — honest "draft-only / via Resend / not connected".
  // No mailbox provider exists yet; this never implies a send happened.
  const mailbox = getMailboxReadiness();

  return (
    <>
      <AdminPageHeader
        titleLead="Prospect"
        titleAccent={displayName}
        contextLabel={`Outreach · ${p.source}`}
        description="Identity, the Apollo enrichment snapshot, qualification tier, and the full engagement record for this prospect."
        lead={
          <Link
            href="/admin/outreach"
            className="body-xs ct-text-muted hover:ct-text-strong"
          >
            ← Outreach
          </Link>
        }
        actions={
          <div className="admin-doc-inline-row admin-doc-inline-row--end">
            <Badge variant={PROSPECT_VARIANT[p.status] ?? "default"}>{p.status}</Badge>
            {p.tier ? (
              <Badge variant={TIER_VARIANT[p.tier] ?? "default"}>Tier {p.tier}</Badge>
            ) : null}
            {p.hubspotContactId ? (
              <a
                href={`https://app-eu1.hubspot.com/contacts/contact/${p.hubspotContactId}`}
                target="_blank"
                rel="noreferrer"
                className="body-xs ct-text-muted hover:ct-text-strong"
              >
                HubSpot ↗
              </a>
            ) : null}
          </div>
        }
      />

      {/* Identity */}
      <AdminDetailSection label="Identity" title="Identity">
        <AdminDetailGrid>
          <AdminDetailItem label="Email">
            <span className="mono ct-text-strong">
              <a href={`mailto:${p.email}`} className="hover:underline">
                {p.email}
              </a>
            </span>
          </AdminDetailItem>
          <AdminDetailItem label="Name">{fullName || "—"}</AdminDetailItem>
          <AdminDetailItem label="Title">{p.title ?? "—"}</AdminDetailItem>
          <AdminDetailItem label="Company">{p.company ?? "—"}</AdminDetailItem>
          <AdminDetailItem label="Source">{p.source}</AdminDetailItem>
          <AdminDetailItem label="Email status">
            {p.emailStatus ? (
              <Badge variant={EMAIL_STATUS_VARIANT[p.emailStatus] ?? "default"}>
                {p.emailStatus}
              </Badge>
            ) : (
              <span className="ct-text-muted">—</span>
            )}
          </AdminDetailItem>
          <AdminDetailItem label="Added">{formatAdminDate(p.createdAt)}</AdminDetailItem>
          <AdminDetailItem label="Last contacted">
            {p.lastContactedAt ? formatAdminDate(p.lastContactedAt) : "—"}
          </AdminDetailItem>
        </AdminDetailGrid>
      </AdminDetailSection>

      {/* Apollo enrichment */}
      <AdminDetailSection
        label="Apollo enrichment"
        title="Apollo enrichment"
        description="The person/org detail captured from Apollo at source time."
      >
        {isApolloSourced || p.linkedinUrl || p.companyDomain || p.industry ? (
          <AdminDetailGrid>
            <AdminDetailItem label="LinkedIn">
              {p.linkedinUrl ? (
                <a
                  href={p.linkedinUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ct-text-accent hover:underline break-all"
                >
                  View profile ↗
                </a>
              ) : (
                "—"
              )}
            </AdminDetailItem>
            <AdminDetailItem label="Company domain">
              <span className="mono">
                {p.companyDomain ? (
                  <a
                    href={`https://${p.companyDomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:underline break-all"
                  >
                    {p.companyDomain}
                  </a>
                ) : (
                  "—"
                )}
              </span>
            </AdminDetailItem>
            <AdminDetailItem label="Industry">{p.industry ?? "—"}</AdminDetailItem>
            <AdminDetailItem label="Apollo ID">
              <span className="mono ct-text-muted break-all">{p.apolloId ?? "—"}</span>
            </AdminDetailItem>
            {extraRows.map((r) => (
              <AdminDetailItem key={r.key} label={r.key}>
                <span className="break-words">{r.value}</span>
              </AdminDetailItem>
            ))}
          </AdminDetailGrid>
        ) : (
          <EmptySurface
            variant="widget"
            message="No Apollo enrichment."
            detail="This prospect was added manually, so there is no Apollo person/org snapshot. Apollo-sourced prospects carry LinkedIn, domain, industry, and the raw enrichment payload."
            className="min-h-24"
          />
        )}
      </AdminDetailSection>

      {/* Qualification */}
      <AdminDetailSection label="Qualification" title="Qualification">
        <AdminDetailGrid>
          <AdminDetailItem label="Lifecycle stage" fullWidth>
            <div className="admin-doc-inline-row">
              <Badge variant={LIFECYCLE_KIND_VARIANT[stage.kind]}>{stage.label}</Badge>
              <span className="body-xs ct-text-muted">{stage.description}</span>
            </div>
          </AdminDetailItem>
          <AdminDetailItem label="Tier">
            {p.tier ? (
              <Badge variant={TIER_VARIANT[p.tier] ?? "default"}>Tier {p.tier}</Badge>
            ) : (
              <span className="ct-text-muted">— (not scored)</span>
            )}
          </AdminDetailItem>
          <AdminDetailItem label="Qualification score">
            <span className="tabular-nums">{p.qualScore != null ? `${p.qualScore} / 100` : "—"}</span>
          </AdminDetailItem>
          <AdminDetailItem label="Sourced for ICP">{p.icpName ?? "—"}</AdminDetailItem>
          <AdminDetailItem label="Sequence step">
            <span className="tabular-nums">{p.sequenceStep}</span>
          </AdminDetailItem>
        </AdminDetailGrid>
      </AdminDetailSection>

      {/* Engagement — emails */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Emails">
        <h2 className="h2">Emails ({p.emails.length})</h2>
        {/* Honest sending posture — no mailbox is connected today; this never
            implies anything was sent. Drafts are always safe. */}
        <p className="body-xs ct-text-muted">Sending: {mailbox.statusLabel}</p>
        {p.emails.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No emails yet."
            detail="No outreach email has been queued or sent to this prospect. Drafts appear here once a campaign drafts to this recipient."
            className="min-h-24"
          />
        ) : (
          <AdminTable
            data={p.emails}
            headers={["Subject", "Campaign", "Status", "Last event", "Sent"]}
            colWidths={["36%", "22%", "16%", "14%", "12%"]}
            renderRow={(e) => (
              <>
                <td className="ct-table-cell truncate ct-text-strong">
                  <Link
                    href={`/admin/outreach/${e.campaignId}`}
                    className="hover:underline"
                  >
                    {e.subject}
                  </Link>
                </td>
                <td className="hidden ct-table-cell truncate ct-text-muted md:table-cell">
                  {e.campaignName ?? "—"}
                </td>
                <td className="ct-table-cell ct-text-body">
                  {e.status}
                  {e.draftedByAgent ? (
                    <span className="body-xs ct-text-muted"> · agent</span>
                  ) : null}
                </td>
                <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                  {e.latestEventType ?? "—"}
                </td>
                <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                  {e.sentAt ? formatAdminDate(e.sentAt) : "—"}
                </td>
              </>
            )}
          />
        )}
      </section>

      {/* Engagement — replies */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Replies">
        <h2 className="h2">Replies ({p.replies.length})</h2>
        {p.replies.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No replies yet."
            detail="Inbound replies matched to this prospect appear here, classified by intent once the reply handler processes them."
            className="min-h-24"
          />
        ) : (
          <div className="admin-doc-stack admin-doc-stack--list">
            {p.replies.map((r) => (
              <Card key={r.id} className="p-[var(--ct-space-5)]" hoverOverlay={false}>
                <div className="admin-doc-stack admin-doc-stack--tight">
                  <div className="admin-doc-inline-row">
                    {r.intent ? (
                      <Badge variant={INTENT_VARIANT[r.intent] ?? "default"}>
                        {r.intent}
                      </Badge>
                    ) : (
                      <Badge variant="default">unclassified</Badge>
                    )}
                    {r.actionTaken ? (
                      <span className="body-xs ct-text-muted">→ {r.actionTaken}</span>
                    ) : null}
                    {r.confidence != null ? (
                      <span className="body-xs ct-text-muted">
                        {r.confidence}% confidence
                      </span>
                    ) : null}
                    <span className="body-xs ct-text-muted">
                      {formatAdminDate(r.createdAt)}
                    </span>
                  </div>
                  {r.subject ? (
                    <p className="body-sm ct-text-strong m-0">{r.subject}</p>
                  ) : null}
                  <p className="body-xs ct-text-muted whitespace-pre-wrap m-0">
                    {r.body}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* Notes & tags */}
      {(p.notes || p.tags.length > 0) && (
        <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Notes">
          <h2 className="h2">Notes &amp; tags</h2>
          <Card className="p-[var(--ct-space-6)]" hoverOverlay={false}>
            <div className="admin-doc-stack admin-doc-stack--tight">
              {p.tags.length > 0 ? (
                <div className="admin-doc-inline-row">
                  {p.tags.map((t) => (
                    <Badge key={t} variant="default">
                      {t}
                    </Badge>
                  ))}
                </div>
              ) : null}
              {p.notes ? (
                <p className="body-sm ct-text-body whitespace-pre-wrap m-0">{p.notes}</p>
              ) : null}
            </div>
          </Card>
        </section>
      )}
    </>
  );
}
