// Admin · Outreach — email-agent control surface.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loaders in
// @/lib/data/outreach; client islands (forms) below import the server actions.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptySurface } from "@/components/ui/empty-surface";
import { OutreachStatsCards } from "@/components/admin/outreach/stats-cards";
import { ProspectAddForm } from "@/components/admin/outreach/prospect-add-form";
import { ProspectImportForm } from "@/components/admin/outreach/prospect-import-form";
import { CampaignForm } from "@/components/admin/outreach/campaign-form";
import { IcpForm } from "@/components/admin/outreach/icp-form";
import { IcpList } from "@/components/admin/outreach/icp-list";
import { TierBadge } from "@/components/admin/outreach/tier-badge";
import {
  computeOutreachStats,
  loadProspects,
  loadCampaigns,
  loadIcps,
} from "@/lib/data/outreach";
import { formatAdminDate } from "@/lib/vaults/product-display";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Outreach — Hearst Connect",
};

/** Prospect lifecycle status → Badge variant. */
const PROSPECT_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger" | "accent"
> = {
  new: "default",
  contacted: "accent",
  opened: "accent",
  replied: "success",
  qualified: "success",
  converted: "success",
  opted_out: "warning",
  bounced: "danger",
};

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

export default async function OutreachPage() {
  const [stats, prospects, campaigns, icps] = await Promise.all([
    computeOutreachStats(),
    loadProspects(),
    loadCampaigns(),
    loadIcps(),
  ]);

  return (
    <>
      <AdminPageHeader
        titleLead="Outreach"
        titleAccent="Console"
        contextLabel="Outreach Console"
        actions={
          <Button asChild variant="primary" size="md">
            <Link href="/admin/outreach/compose">Compose email</Link>
          </Button>
        }
      />

      {/* Engagement overview — single compact stats source (no big KPI panel,
          no duplicated Prospects: that count lives in the directory heading). */}
      <section aria-label="Outreach overview">
        <OutreachStatsCards stats={stats} />
      </section>

      {/* Operator content #1 — Prospect directory (the primary working view). */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Prospects">
        <h2 className="h2">Prospect directory ({prospects.total})</h2>

        <div className="admin-doc-toolbar">
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <ProspectAddForm />
            <ProspectImportForm />
          </div>
        </div>

        {prospects.rows.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No prospects loaded yet."
            detail="Add a prospect manually or import a batch list to establish the recipient set for campaign drafting. Agent output remains in review until an operator approves each email."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[30%] stat-label ct-table-header whitespace-nowrap">
                      Email
                    </th>
                    <th className="hidden w-[22%] stat-label ct-table-header whitespace-nowrap md:table-cell">
                      Company
                    </th>
                    <th className="hidden w-[18%] stat-label ct-table-header whitespace-nowrap lg:table-cell">
                      Name
                    </th>
                    <th className="w-[14%] stat-label ct-table-header whitespace-nowrap">
                      Tier
                    </th>
                    <th className="w-[14%] stat-label ct-table-header whitespace-nowrap">
                      Status
                    </th>
                    <th className="hidden w-[12%] stat-label ct-table-header whitespace-nowrap lg:table-cell">
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.rows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-(--ct-border-soft) last:border-0"
                    >
                      <td className="ct-table-cell truncate ct-text-strong">
                        {p.email}
                      </td>
                      <td className="hidden ct-table-cell truncate ct-text-body md:table-cell">
                        {p.company ?? "—"}
                      </td>
                      <td className="hidden ct-table-cell truncate ct-text-muted lg:table-cell">
                        {[p.firstName, p.lastName].filter(Boolean).join(" ") || "—"}
                      </td>
                      <td className="ct-table-cell">
                        <TierBadge prospectId={p.id} tier={p.tier} />
                      </td>
                      <td className="ct-table-cell">
                        <Badge variant={PROSPECT_VARIANT[p.status] ?? "default"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                        {formatAdminDate(p.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Campaigns */}
      <section className="admin-doc-stack admin-doc-stack--actions" aria-label="Campaigns">
        <h2 className="h2">Campaign queue ({campaigns.length})</h2>
        <p className="body-xs ct-text-muted">
          Define campaign mandates, monitor drafting status, and open each workflow
          for recipient-level review.
        </p>

        <div className="admin-doc-toolbar">
          <div className="admin-doc-inline-row admin-doc-inline-row--actions">
            <CampaignForm />
          </div>
        </div>

        {campaigns.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No campaigns configured yet."
            detail="Create a campaign to issue the operator brief for agent drafting. Nothing is sent automatically; each recipient draft stays in review until approval."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr>
                    <th className="w-[34%] stat-label ct-table-header whitespace-nowrap">
                      Name
                    </th>
                    <th className="w-[16%] stat-label ct-table-header whitespace-nowrap">
                      Kind
                    </th>
                    <th className="w-[16%] stat-label ct-table-header whitespace-nowrap">
                      Status
                    </th>
                    <th className="hidden w-[12%] stat-label ct-table-header whitespace-nowrap text-right md:table-cell">
                      Emails
                    </th>
                    <th className="hidden w-[16%] stat-label ct-table-header whitespace-nowrap lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-(--ct-border-soft) last:border-0"
                    >
                      <td className="ct-table-cell truncate ct-text-strong">
                        <Link
                          href={`/admin/outreach/${c.id}`}
                          className="hover:underline"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="ct-table-cell ct-text-muted">{c.kind}</td>
                      <td className="ct-table-cell">
                        <Badge variant={CAMPAIGN_VARIANT[c.status] ?? "default"}>
                          {c.status}
                        </Badge>
                      </td>
                      <td className="hidden ct-table-cell text-right tabular-nums ct-text-body md:table-cell">
                        {c.total}
                      </td>
                      <td className="hidden ct-table-cell ct-text-muted lg:table-cell">
                        {formatAdminDate(c.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </section>

      {/* Lead engine — SECONDARY tool, demoted below the operator content.
          ICP management lives here; the conversational copilot that used to sit
          beside it (source / show tier / stats) has moved into the cockpit chat
          (admin mode → outreach_* tools), so there is no separate outreach chat.
          Sourcing is MOCK until Apollo is wired; nothing is sent, every email
          stays human-approved. */}
      <section
        className="admin-doc-stack admin-doc-stack--actions outreach-engine-aside"
        aria-label="Lead engine"
      >
        <div className="outreach-engine-aside__head">
          <h2 className="h3">Lead engine</h2>
          <span className="body-xs ct-text-muted">
            Source &amp; tier leads from a distributor ICP — run it from the cockpit chat, never sends.
          </span>
        </div>
        <div className="admin-doc-stack admin-doc-stack--actions">
          <div className="admin-doc-toolbar">
            <div className="admin-doc-inline-row admin-doc-inline-row--actions">
              <IcpForm />
            </div>
          </div>
          <IcpList icps={icps} />
        </div>
      </section>
    </>
  );
}
