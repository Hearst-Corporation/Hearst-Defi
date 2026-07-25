import Link from "next/link";

import { FORM_SURFACE } from "@/components/admin/admin-page-shell";
import { ProofList } from "@/components/admin/proof-list";
import { Button } from "@/ui";
import { PageHeader, PageLayout, Panel, Section } from "@/views/_shared/layout";

/** Newest-first window fetched by the page — declared on screen, never silent. */
export const PROOF_LIBRARY_TAKE = 200;

export function AdminProofsView({
  items,
  total,
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
    /** ECDSA + allowlist verdict — `null` when the row has no signature. */
    signatureVerified?: boolean | null;
  }>;
  /** Total rows on record (prisma.proof.count) — may exceed items.length. */
  total: number;
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
          title={`Showing ${items.length} of ${total}`}
          description={
            total > items.length
              ? `Newest ${PROOF_LIBRARY_TAKE} records — older entries are not listed on this view.`
              : undefined
          }
        >
          <div className={FORM_SURFACE}>
            <ProofList items={items} />
          </div>
        </Panel>
      </Section>
    </PageLayout>
  );
}
