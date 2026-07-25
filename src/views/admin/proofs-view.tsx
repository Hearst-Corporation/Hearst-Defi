import Link from "next/link";

import { ProofList } from "@/components/admin/proof-list";
import { Button } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

export function AdminProofsView({
  items,
}: {
  items: Array<{
    id: string;
    proofType: string;
    period: string | null;
    hash: string;
    uri: string;
    postedAt: Date;
    postedBy: string;
    notes?: string | null;
    txHash?: string | null;
  }>;
}) {
  return (
    <PageLayout>
      <PageHeader
        eyebrow="Proof & system"
        title="Proof library"
        description="Published evidence released to the public Proof Center."
        actions={
          <Link href="/admin/proof-center/full">
            <Button variant="secondary">View in Proof Center</Button>
          </Link>
        }
      />

      <Section
        title="Published evidence"
        description="Most recent first."
      >
        <Panel
          title={`${items.length} item${items.length === 1 ? "" : "s"}`}
        >
          <div className="p-5">
            <ProofList items={items} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
