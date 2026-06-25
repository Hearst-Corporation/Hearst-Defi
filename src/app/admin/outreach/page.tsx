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
import { OutreachAutonomyPanel } from "@/components/admin/outreach/autonomy-panel";
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
    <>
      <AdminPageHeader
        titleLead="Outreach"
        titleAccent="Console"
        contextLabel="Outreach Console"
        actions={
          <div className="flex items-center gap-[var(--ct-space-4)]">
            <OutreachStatsCards stats={stats} />
            <div className="w-px h-8 bg-[var(--ct-border-soft)] mx-[var(--ct-space-1)]" />
            <Button asChild variant="primary" size="md" className="shadow-sm">
              <Link href="/admin/outreach/compose">Compose email</Link>
            </Button>
          </div>
        }
      />

      {/* Primary Control: Autonomy & Readiness Strip */}
      <section className="admin-doc-stack admin-doc-stack--compact px-[var(--ct-space-4)] lg:px-0" aria-label="Outreach status">
        <OutreachAutonomyPanel status={autonomy} />
      </section>

      {/* Main Cockpit: Two-column layout for Prospects and Lead Engine */}
      <div className="admin-doc-split-grid admin-doc-split-grid--brief mt-[var(--ct-space-8)] px-[var(--ct-space-4)] lg:px-0">
        {/* Left: Primary Operator Content */}
        <div className="admin-doc-stack gap-[var(--ct-space-8)]">
          {/* Prospect directory */}
          <section className="admin-doc-stack gap-[var(--ct-space-4)]" aria-label="Prospects">
            <div className="admin-doc-inline-row--between">
              <h2 className="h2">Prospect directory <span className="ct-text-faint font-normal tabular-nums ml-1">({prospects.total})</span></h2>
              <div className="admin-doc-inline-row--actions gap-[var(--ct-space-2)]">
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
          <Card className="p-0 overflow-hidden border-[var(--ct-border-soft)]" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr className="bg-[var(--ct-graphite-subtle-bg)]/30">
                    <th className="w-[30%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Email
                    </th>
                    <th className="hidden w-[22%] stat-label ct-table-header whitespace-nowrap md:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Company
                    </th>
                    <th className="hidden w-[18%] stat-label ct-table-header whitespace-nowrap lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Name
                    </th>
                    <th className="w-[14%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Tier
                    </th>
                    <th className="w-[14%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Status
                    </th>
                    <th className="hidden w-[12%] stat-label ct-table-header whitespace-nowrap lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Added
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ct-border-soft)]">
                  {prospects.rows.map((p) => (
                    <tr
                      key={p.id}
                      className="hover:bg-[var(--ct-graphite-subtle-bg)]/10 transition-colors"
                    >
                      <td className="ct-table-cell truncate ct-text-strong py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <Link
                          href={`/admin/outreach/prospects/${p.id}`}
                          className="hover:underline decoration-[var(--ct-accent)]/30 underline-offset-4"
                        >
                          {p.email}
                        </Link>
                      </td>
                      <td className="hidden ct-table-cell truncate ct-text-body md:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        {p.company ?? "—"}
                      </td>
                      <td className="hidden ct-table-cell truncate ct-text-muted lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <Link
                          href={`/admin/outreach/prospects/${p.id}`}
                          className="hover:underline decoration-[var(--ct-accent)]/30 underline-offset-4"
                        >
                          {[p.firstName, p.lastName].filter(Boolean).join(" ") || "View"}
                        </Link>
                      </td>
                      <td className="ct-table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <TierBadge prospectId={p.id} tier={p.tier} />
                      </td>
                      <td className="ct-table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <Badge variant={PROSPECT_VARIANT[p.status] ?? "default"} className="font-medium">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="hidden ct-table-cell ct-text-faint tabular-nums lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
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
          <section className="admin-doc-stack gap-[var(--ct-space-4)]" aria-label="Campaigns">
            <div className="admin-doc-inline-row--between">
              <div className="admin-doc-stack gap-0">
                <h2 className="h2">Campaign queue <span className="ct-text-faint font-normal tabular-nums ml-1">({campaigns.length})</span></h2>
                <p className="body-xs ct-text-faint">
                  Define mandates, monitor drafting, and review recipient workflows.
                </p>
              </div>
              <CampaignForm />
            </div>

            {campaigns.length === 0 ? (
          <EmptySurface
            variant="widget"
            message="No campaigns configured yet."
            detail="Create a campaign to issue the operator brief for agent drafting. Nothing is sent automatically; each recipient draft stays in review until approval."
            className="min-h-32"
          />
        ) : (
          <Card className="p-0 overflow-hidden border-[var(--ct-border-soft)]" hoverOverlay={false}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-left body-sm">
                <thead>
                  <tr className="bg-[var(--ct-graphite-subtle-bg)]/30">
                    <th className="w-[34%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Name
                    </th>
                    <th className="w-[16%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Kind
                    </th>
                    <th className="w-[16%] stat-label ct-table-header whitespace-nowrap py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Status
                    </th>
                    <th className="hidden w-[12%] stat-label ct-table-header whitespace-nowrap text-right md:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Emails
                    </th>
                    <th className="hidden w-[16%] stat-label ct-table-header whitespace-nowrap lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--ct-border-soft)]">
                  {campaigns.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[var(--ct-graphite-subtle-bg)]/10 transition-colors"
                    >
                      <td className="ct-table-cell truncate ct-text-strong py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <Link
                          href={`/admin/outreach/${c.id}`}
                          className="hover:underline decoration-[var(--ct-accent)]/30 underline-offset-4"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="ct-table-cell ct-text-muted py-[var(--ct-space-3)] px-[var(--ct-space-4)]">{c.kind}</td>
                      <td className="ct-table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        <Badge variant={CAMPAIGN_VARIANT[c.status] ?? "default"} className="font-medium">
                          {c.status}
                        </Badge>
                      </td>
                      <td className="hidden ct-table-cell text-right tabular-nums ct-text-body md:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
                        {c.total}
                      </td>
                      <td className="hidden ct-table-cell ct-text-faint tabular-nums lg:table-cell py-[var(--ct-space-3)] px-[var(--ct-space-4)]">
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
        </div>

        {/* Right: Lead Engine Sidebar */}
        <aside className="admin-doc-stack">
          <section
            className="admin-doc-stack outreach-engine-aside"
            aria-label="Lead engine"
            style={{ marginTop: 0 }}
          >
            <div className="outreach-engine-aside__head mb-[var(--ct-space-2)]">
              <h2 className="h2">Lead engine</h2>
              <span className="body-xs ct-text-faint">
                Source &amp; tier leads from ICP.
              </span>
            </div>
            <div className="admin-doc-stack gap-[var(--ct-space-4)]">
              <div className="admin-doc-toolbar">
                <div className="admin-doc-inline-row admin-doc-inline-row--actions">
                  <IcpForm />
                </div>
              </div>
              <IcpList icps={icps} />
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
