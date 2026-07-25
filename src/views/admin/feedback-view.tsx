import { FeedbackForm } from "@/components/admin/feedback-form";
import { FeedbackList } from "@/components/admin/feedback-list";
import { buildFeedbackKpiStrip } from "@/lib/admin/feedback-kpi-strip";
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

export function AdminFeedbackView({ items }: { items: FeedbackItem[] }) {
  const kpis = buildFeedbackKpiStrip(items);

  return (
    <PageLayout>
      <PageHeader
        eyebrow="Feedback review"
        title="Feedback"
        description={`${items.length} ${items.length === 1 ? "entry" : "entries"} logged.`}
      />

      {kpis.length > 0 ? (
        <KpiGrid>
          {kpis.map((kpi) => (
            <Panel key={kpi.label}>
              <div className="p-5">
                <Kpi
                  label={kpi.label}
                  value={kpi.value}
                  hint={kpi.sublabel}
                  provenance="manual"
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
          <div className="p-5">
            <FeedbackForm />
          </div>
        </Panel>
      </Section>

      <Section
        title={`Feedback log (${items.length})`}
        description="Most recent first; resolved items sink to the bottom."
      >
        <Panel>
          <FeedbackList items={items} />
        </Panel>
      </Section>
    </PageLayout>
  );
}
