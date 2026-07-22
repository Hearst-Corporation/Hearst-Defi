import { Series1Page, Series1PageTitle, Series1Section } from "@/components/series1-shell/Series1Page";
import { Series1Panel } from "@/components/series1-shell/Series1Panel";
import { Series1ProvenanceTag } from "@/components/series1-shell/Series1ChartPlaceholder";

const PROOF_BLOCKS = [
  { id: "mining", eyebrow: "Operations", title: "Proof of mining" },
  { id: "reserves", eyebrow: "B1 / B2 / B3", title: "Proof of reserves" },
  { id: "custody", eyebrow: "Custody", title: "Proof of custody" },
  { id: "delivery", eyebrow: "Maturity", title: "Proof of delivery" },
  { id: "contract", eyebrow: "On-chain", title: "Contract events" },
  { id: "curtailment", eyebrow: "Operations", title: "Curtailment & take-profit" },
];

export const metadata = {
  title: "Proof Center · Hearst Bitcoin Reserve Vault — Series 1",
};

export default function ProductProofCenterPage() {
  return (
    <Series1Page>
      <Series1PageTitle
        title="Proof Center"
        description="Source evidence for mining, reserve, custody and delivery across the Series 1 lifecycle."
      />

      <Series1Section
        index="01"
        title="Proof register"
        description="Every record is presented with its current source provenance and freshness."
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {PROOF_BLOCKS.map((block) => (
            <Series1Panel key={block.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--s1-muted)" }}>
                    {block.eyebrow}
                  </span>
                  <h3 className="text-sm font-semibold">{block.title}</h3>
                </div>
                <Series1ProvenanceTag status="unavailable" />
              </div>
              <div className="mt-4 flex items-center justify-between gap-3 border-t pt-3" style={{ borderColor: "var(--s1-line)" }}>
                <span className="text-sm font-medium" style={{ color: "var(--s1-muted)" }}>
                  Not yet available
                </span>
                <span className="text-[10px]" style={{ color: "var(--s1-muted)" }}>
                  Appears once the vault operates
                </span>
              </div>
            </Series1Panel>
          ))}

          <Series1Panel className="p-5">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-semibold tracking-[0.1em] uppercase" style={{ color: "var(--s1-muted)" }}>
                Source recency
              </span>
              <h3 className="text-sm font-semibold">Proof freshness</h3>
            </div>
            <p className="mt-4 border-t pt-3 text-xs leading-5" style={{ borderColor: "var(--s1-line)", color: "var(--s1-muted)" }}>
              No source has been recorded yet for the current reporting window.
            </p>
          </Series1Panel>
        </div>

        <p className="mt-5 text-xs leading-6" style={{ color: "var(--s1-muted)" }}>
          Series 1 accumulates Bitcoin over a 24-month term and settles at maturity. Delivery evidence appears after a
          maturity settlement is recorded. Estimated accumulation is disclosed as a range and is not guaranteed. Each
          proof block above shows its own source provenance; blocks read &ldquo;Not yet available&rdquo; until a
          source is recorded.
        </p>
      </Series1Section>
    </Series1Page>
  );
}
