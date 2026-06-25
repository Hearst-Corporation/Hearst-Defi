// Skeleton preview — loading placeholders (rect / circle / text variants) and the
// composed SkeletonCard used while a dashboard panel resolves.
import { Skeleton, SkeletonCard } from "hearst-connect";

const wrap: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  minWidth: "320px",
};

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--ct-text-muted)",
};

export const Variants = () => (
  <div style={wrap}>
    <span style={labelStyle}>rect · circle · text</span>
    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
      <Skeleton className="h-16 w-32" />
      <Skeleton variant="circle" className="h-12 w-12" />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <Skeleton variant="text" className="w-2/3" />
      <Skeleton variant="text" className="w-full" />
      <Skeleton variant="text" className="w-1/2" />
    </div>
  </div>
);

export const MetricRow = () => (
  <div style={{ ...wrap, minWidth: "360px" }}>
    <span style={labelStyle}>Loading KPI row</span>
    <div style={{ display: "flex", gap: "16px" }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}
        >
          <Skeleton variant="text" className="h-3 w-1/2" />
          <Skeleton className="h-7 w-3/4" />
        </div>
      ))}
    </div>
  </div>
);

export const Card = () => (
  <div style={{ width: "340px" }}>
    <SkeletonCard />
  </div>
);
