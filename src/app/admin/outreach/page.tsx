// Admin · Outreach — email-agent control surface.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loaders in
// @/lib/data/outreach; client islands (forms) below import the server actions.

import Link from "next/link";

import {
  AdminPageShell,
  AdminSectionCard,
  TABLE_HEAD,
  TABLE_WRAP,
  ROW,
} from "@/components/admin/admin-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/catalyst/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/catalyst/table";
import { EmptySurface } from "@/components/ui/empty-surface";
import { OutreachStatsCards } from "@/components/admin/outreach/stats-cards";
import { OutreachAutonomyPanel } from "@/components/admin/outreach/autonomy-panel";
import { ProspectAddForm } from "@/components/admin/outreach/prospect-add-form";
import { ProspectImportForm } from "@/components/admin/outreach/prospect-import-form";
import { CampaignForm } from "@/components/admin/outreach/campaign-form";
import { IcpForm } from "@/components/admin/outreach/icp-form";
import { IcpList } from "@/components/admin/outreach/icp-list";
import { TierBadge } from "@/components/admin/outreach/tier-badge";
import { CATALYST_ACCENT_BTN } from "@/lib/ui/catalyst-accent";
import {
  computeOutreachStats,
  loadProspects,
  loadCampaigns,
  loadIcps,
} from "@/lib/data/outreach";
import { getOutreachAutonomyStatus } from "@/lib/outreach/autonomy-status";
import { formatAdminDate } from "@/lib/vaults/product-display";
import { PROSPECT_VARIANT, CAMPAIGN_VARIANT } from "@/lib/outreach/status-variants";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Outreach — Hearst Connect",
};

export default async function OutreachPage() {
  const [stats, prospects, campaigns, icps] = await Promise.all([
    computeOutreachStats(),
    loadProspects(),
    loadCampaigns(),
    loadIcps(),
  ]);
  // Read-only posture for the autonomy panel — no DB, no send, no secret leak.
  const autonomy = getOutreachAutonomyStatus();

  return (
    <AdminPageShell
      titleLead="Outreach"
      titleAccent="Console"
      headerActions={
        <div className="flex flex-wrap items-center gap-4">
          <OutreachStatsCards stats={stats} />
          <div className="hidden h-8 w-px bg-[var(--ct-border)] lg:block" />
          <Button href="/admin/outreach/compose" className={CATALYST_ACCENT_BTN}>
            Compose email
          </Button>
        </div>
      }
    >
        {/* Primary Control: Autonomy & Readiness Strip */}
        <section aria-label="Outreach status">
          <OutreachAutonomyPanel status={autonomy} />
        </section>

        {/* Main Cockpit: Two-column layout for Prospects and Lead Engine */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.8fr_minmax(300px,1fr)]">
          {/* Left: Primary Operator Content */}
          <div className="flex flex-col gap-5">
            {/* Prospect directory */}
            <AdminSectionCard
              ariaLabel="Prospects"
              title={
                <>
                  Prospect directory{" "}
                  <span className="font-normal tabular-nums text-[var(--ct-text-muted)]">
                    ({prospects.total})
                  </span>
                </>
              }
              headerTrailing={
                <>
                  <ProspectAddForm />
                  <ProspectImportForm />
                </>
              }
            >
              {prospects.rows.length === 0 ? (
                <EmptySurface
                  variant="widget"
                  message="No prospects loaded yet."
                  detail="Add a prospect manually or import a batch list to establish the recipient set for campaign drafting. Agent output remains in review until an operator approves each email."
                  className="min-h-32"
                />
              ) : (
                <Table dense className={TABLE_WRAP}>
                  <TableHead>
                    <TableRow>
                      <TableHeader className={`${TABLE_HEAD} pl-5`}>Email</TableHeader>
                      <TableHeader className={`${TABLE_HEAD} hidden md:table-cell`}>
                        Company
                      </TableHeader>
                      <TableHeader className={`${TABLE_HEAD} hidden lg:table-cell`}>
                        Name
                      </TableHeader>
                      <TableHeader className={TABLE_HEAD}>Tier</TableHeader>
                      <TableHeader className={TABLE_HEAD}>Status</TableHeader>
                      <TableHeader
                        className={`${TABLE_HEAD} hidden pr-5 lg:table-cell`}
                      >
                        Added
                      </TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {prospects.rows.map((p) => (
                      <TableRow key={p.id} className={ROW}>
                        <TableCell className="pl-5">
                          <Link
                            href={`/admin/outreach/prospects/${p.id}`}
                            className="ct-metric-value min-w-0 truncate hover:underline"
                          >
                            {p.email}
                          </Link>
                        </TableCell>
                        <TableCell className="ct-metric-caption hidden truncate md:table-cell">
                          {p.company ?? "—"}
                        </TableCell>
                        <TableCell className="ct-metric-caption hidden truncate lg:table-cell">
                          <Link
                            href={`/admin/outreach/prospects/${p.id}`}
                            className="hover:underline"
                          >
                            {[p.firstName, p.lastName].filter(Boolean).join(" ") || "View"}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <TierBadge prospectId={p.id} tier={p.tier} />
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={PROSPECT_VARIANT[p.status] ?? "default"}
                            className="font-medium"
                          >
                            {p.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="ct-metric-caption hidden pr-5 tabular-nums lg:table-cell">
                          {formatAdminDate(p.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AdminSectionCard>

            {/* Campaigns */}
            <AdminSectionCard
              ariaLabel="Campaigns"
              title={
                <>
                  Campaign queue{" "}
                  <span className="font-normal tabular-nums text-[var(--ct-text-muted)]">
                    ({campaigns.length})
                  </span>
                </>
              }
              subtitle="Define mandates, monitor drafting, and review recipient workflows."
              headerTrailing={<CampaignForm />}
            >
              {campaigns.length === 0 ? (
                <EmptySurface
                  variant="widget"
                  message="No campaigns configured yet."
                  detail="Create a campaign to issue the operator brief for agent drafting. Nothing is sent automatically; each recipient draft stays in review until approval."
                  className="min-h-32"
                />
              ) : (
                <Table dense className={TABLE_WRAP}>
                  <TableHead>
                    <TableRow>
                      <TableHeader className={`${TABLE_HEAD} pl-5`}>Name</TableHeader>
                      <TableHeader className={TABLE_HEAD}>Kind</TableHeader>
                      <TableHeader className={TABLE_HEAD}>Status</TableHeader>
                      <TableHeader
                        className={`${TABLE_HEAD} hidden text-right md:table-cell`}
                      >
                        Emails
                      </TableHeader>
                      <TableHeader
                        className={`${TABLE_HEAD} hidden pr-5 lg:table-cell`}
                      >
                        Created
                      </TableHeader>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {campaigns.map((c) => (
                      <TableRow key={c.id} className={ROW}>
                        <TableCell className="pl-5">
                          <Link
                            href={`/admin/outreach/${c.id}`}
                            className="ct-metric-value min-w-0 truncate hover:underline"
                          >
                            {c.name}
                          </Link>
                        </TableCell>
                        <TableCell className="ct-metric-caption">{c.kind}</TableCell>
                        <TableCell>
                          <Badge
                            variant={CAMPAIGN_VARIANT[c.status] ?? "default"}
                            className="font-medium"
                          >
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="ct-metric-caption hidden text-right tabular-nums md:table-cell">
                          {c.total}
                        </TableCell>
                        <TableCell className="ct-metric-caption hidden pr-5 tabular-nums lg:table-cell">
                          {formatAdminDate(c.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </AdminSectionCard>
          </div>

          {/* Right: Lead Engine Sidebar */}
          <aside className="flex flex-col">
            <section className="flex flex-col gap-4" aria-label="Lead engine">
              <div className="flex flex-col gap-1">
                <h2 className="ct-section-title">Lead engine</h2>
                <span className="ct-metric-caption">
                  Source &amp; tier leads from ICP.
                </span>
              </div>
              <div className="flex flex-col gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <IcpForm />
                </div>
                <IcpList icps={icps} />
              </div>
            </section>
          </aside>
        </div>
    </AdminPageShell>
  );
}
