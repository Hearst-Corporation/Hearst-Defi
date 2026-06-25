// ProvenanceBadge preview — every metric on the platform carries a provenance
// badge (non-negotiable). Shows all eight kinds plus the compact and strip forms.
import { ProvenanceBadge } from "hearst-connect";

const KINDS = [
  "live",
  "oracle",
  "attested",
  "estimated",
  "partial",
  "manual",
  "stale",
  "simulated",
] as const;

const wrap: React.CSSProperties = {
  display: "flex",
  gap: "10px",
  alignItems: "center",
  flexWrap: "wrap",
};

export const AllKinds = () => (
  <div style={wrap}>
    {KINDS.map((k) => (
      <ProvenanceBadge key={k} kind={k} />
    ))}
  </div>
);

export const Compact = () => (
  <div style={wrap}>
    {KINDS.map((k) => (
      <ProvenanceBadge key={k} kind={k} compact />
    ))}
  </div>
);

export const Strip = () => (
  <div style={{ ...wrap, gap: "16px" }}>
    {KINDS.map((k) => (
      <ProvenanceBadge key={k} kind={k} variant="strip" />
    ))}
  </div>
);
