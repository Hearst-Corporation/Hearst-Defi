// Admin · Prospect detail — the CRM sheet for a single outreach prospect.
// Server Component — gated by the admin layout (session.role). Pure display:
// identity + the Apollo enrichment snapshot + scoring/tier + the full
// engagement record (emails sent, inbound replies). No writes here; the table
// in /admin/outreach links each prospect to this page (drill-down, dedicated
// page per the no-scroll direction — not a slide-over).

import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import { BentoBadge as Badge } from "@/components/catalyst/bento-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { loadProspectDetail } from "@/lib/data/outreach";
import { AdminDetailItem } from "@/components/admin/admin-detail-layout";
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

// Detail grid inside a welded card body — items-start so short fields never
// stretch to match the tall full-width ones (anti-trou).
const DETAIL_GRID = "grid grid-cols-1 items-start gap-x-8 gap-y-5 p-5 md:grid-cols-2";

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
  // Deterministic mock fallback (no APOLLO_API_KEY at sourcing time) — flag it
  // so this snapshot is never mistaken for a real Apollo enrichment.
  const isMockApollo = p.apolloData?.mock === true;
  const extraRows = extraApolloRows(p.apolloData);
  const stage = lifecycleFor(p.status);
  // Global sending posture — honest "draft-only / via Resend / not connected".
  // No mailbox provider exists yet; this never implies a send happened.
  const mailbox = getMailboxReadiness();

  return (
    <AdminPageShell
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
    >

        {/* Identity */}
        <AdminSectionCard
          ariaLabel="Identity"
          title="Identity"
          subtitle="Contact record, source, and email deliverability status."
        >
          <dl className={DETAIL_GRID}>
            <AdminDetailItem label="Email">
              <span className="break-all mono text-[var(--ct-text-strong)]">
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
          </dl>
        </AdminSectionCard>

        {/* Apollo enrichment */}
        <AdminSectionCard
          ariaLabel="Apollo enrichment"
          title="Apollo enrichment"
          subtitle={
            isMockApollo
              ? "Mock snapshot — no APOLLO_API_KEY was configured when this prospect was sourced."
              : "The person/org detail captured from Apollo at source time."
          }
        >
          {isApolloSourced || p.linkedinUrl || p.companyDomain || p.industry ? (
            <dl className={DETAIL_GRID}>
              {isMockApollo ? (
                <AdminDetailItem label="Data source" fullWidth>
                  <Badge variant="warning">Mock — not a real Apollo response</Badge>
                </AdminDetailItem>
              ) : null}
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
                <span className="mono">
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
                <span className="break-all mono text-[var(--ct-text-body)]">{p.apolloId ?? "—"}</span>
              </AdminDetailItem>
              {extraRows.map((r) => (
                <AdminDetailItem key={r.key} label={r.key}>
                  <span className="break-words">{r.value}</span>
                </AdminDetailItem>
              ))}
            </dl>
          ) : (
            <div className="p-5">
              <EmptySurface
                variant="widget"
                message="No Apollo enrichment."
                detail="This prospect was added manually, so there is no Apollo person/org snapshot. Apollo-sourced prospects carry LinkedIn, domain, industry, and the raw enrichment payload."
                className="min-h-24"
              />
            </div>
          )}
        </AdminSectionCard>

        {/* Qualification */}
        <AdminSectionCard
          ariaLabel="Qualification"
          title="Qualification"
          subtitle="Lifecycle stage, tier, and fit score against the target ICP."
        >
          <dl className={DETAIL_GRID}>
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
          </dl>
        </AdminSectionCard>

        {/* Engagement — emails. Table lives directly inside the welded card (no
            BentoPanel cage); shared TABLE_* chrome keeps it in lockstep. */}
        <AdminSectionCard
          ariaLabel="Emails"
          title={`Emails (${p.emails.length})`}
          subtitle={`Sending: ${mailbox.statusLabel}`}
        >
          {p.emails.length === 0 ? (
            <div className="p-5">
              <EmptySurface
                variant="widget"
                message="No emails yet."
                detail="No outreach email has been queued or sent to this prospect. Drafts appear here once a campaign drafts to this recipient."
                className="min-h-24"
              />
            </div>
          ) : (
            <Table dense className={TABLE_WRAP}>
              <TableHead>
                <TableRow>
                  <TableHeader className={`${TABLE_HEAD} pl-5`}>Subject</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} hidden md:table-cell`}>
                    Campaign
                  </TableHeader>
                  <TableHeader className={TABLE_HEAD}>Status</TableHeader>
                  <TableHeader className={`${TABLE_HEAD} hidden lg:table-cell`}>
                    Last event
                  </TableHeader>
                  <TableHeader className={`${TABLE_HEAD} hidden pr-5 lg:table-cell`}>
                    Sent
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {p.emails.map((e) => (
                  <TableRow key={e.id} className={ROW}>
                    <TableCell className="pl-5">
                      <Link
                        href={`/admin/outreach/${e.campaignId}`}
                        className="ct-metric-value min-w-0 truncate hover:underline"
                      >
                        {e.subject}
                      </Link>
                    </TableCell>
                    <TableCell className="ct-metric-caption hidden min-w-0 truncate md:table-cell">
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
          )}
        </AdminSectionCard>

        {/* Engagement — replies. Each reply is an inset row inside ONE welded card
            (anti-cage: no BentoPanel-per-reply stack). */}
        <AdminSectionCard
          ariaLabel="Replies"
          title={`Replies (${p.replies.length})`}
          subtitle="Inbound replies matched to this prospect, classified by intent."
        >
          {p.replies.length === 0 ? (
            <div className="p-5">
              <EmptySurface
                variant="widget"
                message="No replies yet."
                detail="Inbound replies matched to this prospect appear here, classified by intent once the reply handler processes them."
                className="min-h-24"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3 p-5">
              {p.replies.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-col gap-2 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-4"
                >
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
              ))}
            </div>
          )}
        </AdminSectionCard>

        {/* Notes & tags */}
        {(p.notes || p.tags.length > 0) && (
          <AdminSectionCard
            ariaLabel="Notes"
            title="Notes & tags"
            subtitle="Manual annotations and labels attached to this prospect."
          >
            <div className="flex flex-col gap-2 p-5">
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
          </AdminSectionCard>
        )}
    </AdminPageShell>
  );
}
