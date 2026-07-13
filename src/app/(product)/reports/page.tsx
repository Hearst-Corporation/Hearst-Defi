// /reports — investor report catalog.
//
// Part of the Bitcoin Strategic Reserve reposition (nav V2). Read-only,
// zero-migration navigational catalog over EXISTING report surfaces:
//   - Tax preview (/portfolio/tax) — real, working page.
//   - Investor Statement PDF (/api/statements/[id]/pdf) — real, working route,
//     wired here with the authenticated investor's own id (ownership-checked
//     server-side by the route itself).
// Report types with no dedicated per-investor route yet (mining, performance,
// monthly/quarterly/annual) render as honest, non-clickable "coming soon"
// cards — never a fabricated link.
//
// Server Component — gated by the (product) layout (session required).

import Link from "next/link";

import { PortfolioLeafHeader } from "@/components/portfolio/portfolio-leaf-header";
import { EmptySurface } from "@/components/catalyst/empty-surface";
import { BentoPanel } from "@/components/catalyst/bento";
import { ProvenanceBadge } from "@/components/ui/provenance-badge";
import { getInvestor } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export const metadata = { title: "Reports — Hearst Connect" };

interface ReportCardBase {
  title: string;
  description: string;
}

interface ReportCardLive extends ReportCardBase {
  status: "live";
  href: string;
  cta: string;
}

interface ReportCardSoon extends ReportCardBase {
  status: "coming-soon";
}

type ReportCard = ReportCardLive | ReportCardSoon;

function ReportCardTile({ card }: { card: ReportCard }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="ct-bento-card-title">{card.title}</h3>
        <ProvenanceBadge
          kind={card.status === "live" ? "live" : "estimated"}
          compact
          description={
            card.status === "live"
              ? "This report is generated from your live account data."
              : "Not yet available — planned for a future release."
          }
        />
      </div>
      <p className="ct-metric-caption leading-relaxed">{card.description}</p>
      {card.status === "live" ? (
        <span className="ct-bento-label text-[var(--ct-accent)] mt-auto pt-2">
          {card.cta} →
        </span>
      ) : (
        <span className="ct-bento-label ct-text-faint mt-auto pt-2">
          Coming soon
        </span>
      )}
    </>
  );

  if (card.status === "live") {
    return (
      <Link
        href={card.href}
        className="group flex flex-col gap-2 rounded-2xl border border-[var(--ct-border)] bg-surface-card p-5 shadow-[var(--ct-shadow-soft)] transition-colors hover:border-[var(--ct-border-strong)]"
      >
        {body}
      </Link>
    );
  }

  return (
    <div
      aria-disabled="true"
      className="flex flex-col gap-2 rounded-2xl border border-[var(--ct-border-soft)] bg-surface-card p-5 opacity-[var(--ct-opacity-60)]"
    >
      {body}
    </div>
  );
}

export default async function ReportsPage() {
  const investor = await getInvestor();

  const statementCard: ReportCard = investor
    ? {
        status: "live",
        title: "Investor Statement (PDF)",
        description:
          "Portfolio summary, positions, P&L and year-to-date distributions in a single PDF.",
        href: `/api/statements/${investor.id}/pdf`,
        cta: "Download PDF",
      }
    : {
        status: "live",
        title: "Investor Statement (PDF)",
        description: "Available from your Portfolio once you have an active position.",
        href: "/portfolio",
        cta: "Go to Portfolio",
      };

  const cards: ReportCard[] = [
    {
      status: "live",
      title: "Tax Report",
      description: "1099-INT, 1099-B and CRS year-to-date preview.",
      href: "/portfolio/tax",
      cta: "View preview",
    },
    statementCard,
    {
      status: "coming-soon",
      title: "Mining Report",
      description:
        "Hashrate allocation, production and mining-pool health for the vault's underlying operation.",
    },
    {
      status: "coming-soon",
      title: "Performance Report",
      description:
        "Realized vs. target APY, benchmark comparison and attribution across the holding period.",
    },
    {
      status: "coming-soon",
      title: "Monthly Report",
      description: "Rolling monthly summary of yield accrual and distributions.",
    },
    {
      status: "coming-soon",
      title: "Quarterly Report",
      description: "Quarterly performance and portfolio composition summary.",
    },
    {
      status: "coming-soon",
      title: "Annual Report",
      description: "Full-year statement covering performance, distributions and tax summary.",
    },
  ];

  return (
    <div className="dark flex flex-col gap-y-8 p-5 lg:p-6">
      <PortfolioLeafHeader
        titleLead="Investor"
        titleAccent="Reports"
        kicker="STATEMENTS & DISCLOSURES"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <ReportCardTile key={card.title} card={card} />
        ))}
      </div>

      <BentoPanel>
        <div className="p-5 border-b border-[var(--ct-border-soft)]">
          <h2 className="ct-bento-card-title">Recent Exports</h2>
        </div>
        <div className="p-5">
          <EmptySurface
            message="Your generated reports will appear here."
            detail="Downloads from the cards above are generated on demand and are not yet tracked in a re-download history."
          />
        </div>
      </BentoPanel>
    </div>
  );
}
