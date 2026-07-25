import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import {
  buildFeedbackKpiStrip,
  type FeedbackAggregates,
} from "@/lib/admin/feedback-kpi-strip";
import { Kpi, KpiGrid } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

type FeedbackItem = {
  id: string;
  createdAt: Date;
  itemId: string | null;
  pathname: string | null;
  message: string;
  author: string | null;
  resolved: boolean;
};

export function AdminFeedbackView({
  items,
  totals,
}: {
  /** Capped log window (most recent first) — NOT the whole table. */
  items: FeedbackItem[];
  /** Whole-table aggregates (Prisma count without take). */
  totals: FeedbackAggregates;
}) {
  const kpis = buildFeedbackKpiStrip(totals);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Feedback review"
        title="Feedback"
        description={`${totals.total} ${totals.total === 1 ? "entry" : "entries"} logged.`}
      />

      {kpis.length > 0 ? (
        <KpiGrid>
          {kpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className={FORM_SURFACE}>
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance={kpi.provenance}
                />
              </div>
            </Panel>
          ))}
        </KpiGrid>
      ) : null}

      <Section
        title="Submit feedback"
        description="Capture what changed, what feels off, and what should happen next."
      >
        <Panel>
          <div className={FORM_SURFACE}>
            <FeedbackForm />
          </div>
        </Panel>
      </Section>

      <Section
        title="Feedback log"
        description={`Showing ${items.length} of ${totals.total} — most recent first; resolved items sink to the bottom.`}
      >
        <Panel>
          <FeedbackList items={items} />
        </Panel>
      </Section>
    </PageLayout>
  );
}
