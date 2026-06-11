import { Badge } from "@/components/ui/badge";
import { Tooltip } from "@/components/ui/tooltip";

export type Provenance =
  | "live"
  | "oracle"
  | "attested"
  | "estimated"
  | "partial"
  | "manual"
  | "stale";

const labels: Record<Provenance, string> = {
  live: "Live",
  oracle: "Oracle",
  attested: "Attested",
  estimated: "Estimated",
  partial: "Partial",
  manual: "Manual",
  stale: "Stale",
};

const descriptions: Record<Provenance, string> = {
  live: "Real-time data from direct system integration",
  oracle: "Data verified by decentralized oracles",
  attested: "Data verified by third-party attestation",
  estimated: "Projection based on historical performance",
  partial: "Incomplete data from some sources",
  manual: "Data manually entered by administrators",
  stale: "Data awaiting update from source",
};

const variants: Record<
  Provenance,
  "success" | "brand" | "default" | "warning" | "danger"
> = {
  live: "success",
  oracle: "brand",
  attested: "brand",
  estimated: "default",
  partial: "default",
  manual: "default",
  stale: "default",
};

export function ProvenanceBadge({ kind }: { kind: Provenance }) {
  // "stale" repeats on many cards (e.g. an investor with no positions yet) and
  // reads as alarming when stacked. Keep the information, but render it quietly
  // (reduced opacity) so it stops competing with the numbers. All other kinds
  // are unchanged.
  const muted = kind === "stale";
  return (
    <Tooltip content={descriptions[kind]}>
      <Badge
        variant={variants[kind]}
        className={muted ? "shrink-0 whitespace-nowrap opacity-60" : "shrink-0 whitespace-nowrap"}
      >
        <span
          aria-hidden
          className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-current"
        />
        {labels[kind]}
      </Badge>
    </Tooltip>
  );
}
