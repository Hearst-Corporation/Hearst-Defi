import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Kpi,
  KpiGrid,
  ProvenanceBadge,
} from "@/ui";
import { PageHeader, PageLayout, Section } from "@/views/_shared/layout";

export const metadata = {
  title: "UI Kit — Hearst Connect",
};

export default function DesignSystemPage() {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Greenfield"
        title="Hearst Connect UI Kit"
        description="Source unique : Tailwind v4 + Headless UI + src/ui. Zéro cockpit."
      />

      <Section title="Primitives">
        <div className="flex flex-wrap gap-2">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Badge>Default</Badge>
          <Badge variant="accent">Accent</Badge>
          <ProvenanceBadge source="estimated" />
        </div>
      </Section>

      <Section title="KPI">
        <KpiGrid>
          <Card className="border-none bg-surface-raised">
            <CardContent className="pt-5">
              <Kpi label="TVL" value="$12.4M" provenance="live" />
            </CardContent>
          </Card>
          <Card className="border-none bg-surface-raised">
            <CardContent className="pt-5">
              <Kpi label="BTC accumulated" value="4.218 BTC" provenance="attested" />
            </CardContent>
          </Card>
        </KpiGrid>
      </Section>

      <Section title="Forms">
        <Card>
          <CardHeader>
            <CardTitle>Input</CardTitle>
          </CardHeader>
          <CardContent>
            <Input placeholder="Institutional email" />
          </CardContent>
        </Card>
      </Section>
    </PageLayout>
  );
}
