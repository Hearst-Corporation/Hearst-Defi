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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/ui/empty-surface";
import { BentoPanel } from "@/components/ui/bento";
import { loadProspectDetail } from "@/lib/data/outreach";
import {
  AdminDetailSection,
  AdminDetailGrid,
  AdminDetailItem,
} from "@/components/admin/admin-detail-layout";
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
    <div className="dark flex flex-col rounded-2xl border border-[var(--ct-border)] bg-surface-page mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Prospect"
          titleAccent={displayName}
          contextLabel={`Outreach · ${p.source}`}
          description="Identity, the Apollo enrichment snapshot, qualification tier, and the full engagement record for this prospect."
          lead={
            <Link
              href="/admin/outreach"
              className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
            >
              ← Outreach
            </Link>
          }
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={PROSPECT_VARIANT[p.status] ?? "default"}>{p.status}</Badge>
              {p.tier ? (
                <Badge variant={TIER_VARIANT[p.tier] ?? "default"}>Tier {p.tier}</Badge>
              ) : null}
              {p.hubspotContactId ? (
                <a
                  href={`https://app-eu1.hubspot.com/contacts/contact/${p.hubspotContactId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="ct-metric-caption transition-colors hover:text-[var(--ct-text-strong)]"
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
              <span className="font-mono text-[var(--ct-text-strong)]">
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
                <span className="text-[var(--ct-text-body)]">—</span>
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
                    className="break-all text-[var(--ct-accent)] hover:underline"
                  >
                    View profile ↗
                  </a>
                ) : (
                  "—"
                )}
              </AdminDetailItem>
              <AdminDetailItem label="Company domain">
                <span className="font-mono">
                  {p.companyDomain ? (
                    <a
                      href={`https://${p.companyDomain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all hover:underline"
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
                <span className="break-all font-mono text-[var(--ct-text-body)]">{p.apolloId ?? "—"}</span>
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
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={LIFECYCLE_KIND_VARIANT[stage.kind]}>{stage.label}</Badge>
                <span className="ct-metric-caption">{stage.description}</span>
              </div>
            </AdminDetailItem>
            <AdminDetailItem label="Tier">
              {p.tier ? (
                <Badge variant={TIER_VARIANT[p.tier] ?? "default"}>Tier {p.tier}</Badge>
              ) : (
                <span className="text-[var(--ct-text-body)]">— (not scored)</span>
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
        <section className="flex flex-col gap-4" aria-label="Emails">
          <h2 className="ct-section-title">Emails ({p.emails.length})</h2>
          {/* Honest sending posture — no mailbox is connected today; this never
              implies anything was sent. Drafts are always safe. */}
          <p className="ct-metric-caption">Sending: {mailbox.statusLabel}</p>
          {p.emails.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No emails yet."
              detail="No outreach email has been queued or sent to this prospect. Drafts appear here once a campaign drafts to this recipient."
              className="min-h-24"
            />
          ) : (
            <BentoPanel>
              <Table
                dense
                className="max-w-full [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap"
              >
                <TableHead>
                  <TableRow>
                    <TableHeader className="ct-bento-label pl-5">Subject</TableHeader>
                    <TableHeader className="ct-bento-label hidden md:table-cell">
                      Campaign
                    </TableHeader>
                    <TableHeader className="ct-bento-label">Status</TableHeader>
                    <TableHeader className="ct-bento-label hidden lg:table-cell">
                      Last event
                    </TableHeader>
                    <TableHeader className="ct-bento-label hidden pr-5 lg:table-cell">
                      Sent
                    </TableHeader>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {p.emails.map((e) => (
                    <TableRow
                      key={e.id}
                      className="border-transparent transition-colors hover:bg-[color-mix(in_srgb,var(--ct-text-strong)_2%,transparent)]"
                    >
                      <TableCell className="pl-5">
                        <Link
                          href={`/admin/outreach/${e.campaignId}`}
                          className="ct-metric-value min-w-0 truncate hover:underline"
                        >
                          {e.subject}
                        </Link>
                      </TableCell>
                      <TableCell className="ct-metric-caption hidden truncate md:table-cell">
                        {e.campaignName ?? "—"}
                      </TableCell>
                      <TableCell className="ct-metric-value">
                        {e.status}
                        {e.draftedByAgent ? (
                          <span className="ct-metric-caption"> · agent</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="ct-metric-caption hidden lg:table-cell">
                        {e.latestEventType ?? "—"}
                      </TableCell>
                      <TableCell className="ct-metric-caption hidden pr-5 lg:table-cell">
                        {e.sentAt ? formatAdminDate(e.sentAt) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </BentoPanel>
          )}
        </section>

        {/* Engagement — replies */}
        <section className="flex flex-col gap-4" aria-label="Replies">
          <h2 className="ct-section-title">Replies ({p.replies.length})</h2>
          {p.replies.length === 0 ? (
            <EmptySurface
              variant="widget"
              message="No replies yet."
              detail="Inbound replies matched to this prospect appear here, classified by intent once the reply handler processes them."
              className="min-h-24"
            />
          ) : (
            <div className="flex flex-col gap-3">
              {p.replies.map((r) => (
                <BentoPanel key={r.id} className="p-5">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {r.intent ? (
                        <Badge variant={INTENT_VARIANT[r.intent] ?? "default"}>
                          {r.intent}
                        </Badge>
                      ) : (
                        <Badge variant="default">unclassified</Badge>
                      )}
                      {r.actionTaken ? (
                        <span className="ct-metric-caption">→ {r.actionTaken}</span>
                      ) : null}
                      {r.confidence != null ? (
                        <span className="ct-metric-caption">
                          {r.confidence}% confidence
                        </span>
                      ) : null}
                      <span className="ct-metric-caption">
                        {formatAdminDate(r.createdAt)}
                      </span>
                    </div>
                    {r.subject ? (
                      <p className="ct-metric-value m-0">{r.subject}</p>
                    ) : null}
                    <p className="ct-metric-caption m-0 whitespace-pre-wrap">{r.body}</p>
                  </div>
                </BentoPanel>
              ))}
            </div>
          )}
        </section>

        {/* Notes & tags */}
        {(p.notes || p.tags.length > 0) && (
          <section className="flex flex-col gap-4" aria-label="Notes">
            <h2 className="ct-section-title">Notes &amp; tags</h2>
            <BentoPanel className="p-6">
              <div className="flex flex-col gap-2">
                {p.tags.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {p.tags.map((t) => (
                      <Badge key={t} variant="default">
                        {t}
                      </Badge>
                    ))}
                  </div>
                ) : null}
                {p.notes ? (
                  <p className="body-sm m-0 whitespace-pre-wrap text-[var(--ct-text-body)]">
                    {p.notes}
                  </p>
                ) : null}
              </div>
            </BentoPanel>
          </section>
        )}
      </div>
    </div>
  );
}
