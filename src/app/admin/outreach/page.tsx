// Admin · Outreach — email-agent control surface.
// Server Component — gated by admin layout (session.role), so no
// redundant auth check here. Reads via the server-only loaders in
// @/lib/data/outreach; client islands (forms) below import the server actions.

import Link from "next/link";

import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { Badge } from "@/components/ui/badge";
import { EmptySurface } from "@/components/ui/empty-surface";
import { OutreachStatsCards } from "@/components/admin/outreach/stats-cards";
import { OutreachAutonomyPanel } from "@/components/admin/outreach/autonomy-panel";
import { ProspectAddForm } from "@/components/admin/outreach/prospect-add-form";
import { ProspectImportForm } from "@/components/admin/outreach/prospect-import-form";
import { CampaignForm } from "@/components/admin/outreach/campaign-form";
import { IcpForm } from "@/components/admin/outreach/icp-form";
import { IcpList } from "@/components/admin/outreach/icp-list";
import { TierBadge } from "@/components/admin/outreach/tier-badge";
import { BENTO_PRIMARY_BTN } from "@/components/ui/bento";
import {
  AdminTable,
} from "@/components/admin/admin-table-layout";
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
    <div className="dark flex flex-col rounded-2xl border border-white/10 bg-zinc-900 mb-8">
      <div className="p-5 lg:p-6 flex flex-col gap-y-5">
        <AdminPageHeader
          titleLead="Outreach"
          titleAccent="Console"
          actions={
            <div className="flex flex-wrap items-center gap-4">
              <OutreachStatsCards stats={stats} />
              <div className="hidden h-8 w-px bg-white/10 lg:block" />
              <Link href="/admin/outreach/compose" className={BENTO_PRIMARY_BTN}>
                Compose email
              </Link>
            </div>
          }
        />

        {/* Primary Control: Autonomy & Readiness Strip */}
        <section aria-label="Outreach status">
          <OutreachAutonomyPanel status={autonomy} />
        </section>

        {/* Main Cockpit: Two-column layout for Prospects and Lead Engine */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.8fr_minmax(300px,1fr)]">
          {/* Left: Primary Operator Content */}
          <div className="flex flex-col gap-5">
            {/* Prospect directory */}
            <section className="flex flex-col gap-4" aria-label="Prospects">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-[15px] font-semibold tracking-tight text-white">
                  Prospect directory{" "}
                  <span className="ml-1 font-normal tabular-nums text-zinc-500">
                    ({prospects.total})
                  </span>
                </h2>
                <div className="flex flex-wrap items-center gap-2">
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
                <AdminTable
                  data={prospects.rows}
                  headers={[
                    "Email",
                    <span key="company" className="hidden md:inline">Company</span>,
                    <span key="name" className="hidden lg:inline">Name</span>,
                    "Tier",
                    "Status",
                    <span key="added" className="hidden lg:inline">Added</span>,
                  ]}
                  colWidths={[
                    "w-[30%]",
                    "hidden w-[22%] md:table-cell",
                    "hidden w-[18%] lg:table-cell",
                    "w-[14%]",
                    "w-[14%]",
                    "hidden w-[12%] lg:table-cell",
                  ]}
                  renderRow={(p) => (
                    <>
                      <td className="truncate px-5 py-3 font-medium text-white">
                        <Link
                          href={`/admin/outreach/prospects/${p.id}`}
                          className="underline-offset-4 hover:underline decoration-[#A7FB90]/30"
                        >
                          {p.email}
                        </Link>
                      </td>
                      <td className="hidden truncate px-5 py-3 text-zinc-300 md:table-cell">
                        {p.company ?? "—"}
                      </td>
                      <td className="hidden truncate px-5 py-3 text-zinc-400 lg:table-cell">
                        <Link
                          href={`/admin/outreach/prospects/${p.id}`}
                          className="underline-offset-4 hover:underline decoration-[#A7FB90]/30"
                        >
                          {[p.firstName, p.lastName].filter(Boolean).join(" ") || "View"}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <TierBadge prospectId={p.id} tier={p.tier} />
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={PROSPECT_VARIANT[p.status] ?? "default"} className="font-medium">
                          {p.status}
                        </Badge>
                      </td>
                      <td className="hidden px-5 py-3 tabular-nums text-zinc-500 lg:table-cell">
                        {formatAdminDate(p.createdAt)}
                      </td>
                    </>
                  )}
                />
              )}
            </section>

            {/* Campaigns */}
            <section className="flex flex-col gap-4" aria-label="Campaigns">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <h2 className="text-[15px] font-semibold tracking-tight text-white">
                    Campaign queue{" "}
                    <span className="ml-1 font-normal tabular-nums text-zinc-500">
                      ({campaigns.length})
                    </span>
                  </h2>
                  <p className="text-[12px] text-zinc-500">
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
                <AdminTable
                  data={campaigns}
                  headers={[
                    "Name",
                    "Kind",
                    "Status",
                    <span key="emails" className="hidden text-right md:inline">Emails</span>,
                    <span key="created" className="hidden lg:inline">Created</span>,
                  ]}
                  colWidths={[
                    "w-[34%]",
                    "w-[16%]",
                    "w-[16%]",
                    "hidden w-[12%] text-right md:table-cell",
                    "hidden w-[16%] lg:table-cell",
                  ]}
                  renderRow={(c) => (
                    <>
                      <td className="truncate px-5 py-3 font-medium text-white">
                        <Link
                          href={`/admin/outreach/${c.id}`}
                          className="underline-offset-4 hover:underline decoration-[#A7FB90]/30"
                        >
                          {c.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3 text-zinc-400">{c.kind}</td>
                      <td className="px-5 py-3">
                        <Badge variant={CAMPAIGN_VARIANT[c.status] ?? "default"} className="font-medium">
                          {c.status}
                        </Badge>
                      </td>
                      <td className="hidden px-5 py-3 text-right tabular-nums text-zinc-300 md:table-cell">
                        {c.total}
                      </td>
                      <td className="hidden px-5 py-3 tabular-nums text-zinc-500 lg:table-cell">
                        {formatAdminDate(c.createdAt)}
                      </td>
                    </>
                  )}
                />
              )}
            </section>
          </div>

          {/* Right: Lead Engine Sidebar */}
          <aside className="flex flex-col">
            <section className="flex flex-col gap-4" aria-label="Lead engine">
              <div className="flex flex-col gap-1">
                <h2 className="text-[15px] font-semibold tracking-tight text-white">Lead engine</h2>
                <span className="text-[12px] text-zinc-500">
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
      </div>
    </div>
  );
}
