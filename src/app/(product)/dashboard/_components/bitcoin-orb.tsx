// BitcoinOrb — the animated orbital glyph in the corner of the KPI band.
// Pure SVG, no runtime data. Three concentric rings counter-rotate around a
// glowing ₿ core, with orbiting satellites. Motion lives in
// dashboard-signature.css and is disabled under prefers-reduced-motion.
//
// tone: "accent" (green, /dashboard) | "btc" (orange, /btc). The colour is
// driven by the CSS custom property --orb-color so the same markup serves both
// surfaces.

interface BitcoinOrbProps {
  tone?: "accent" | "btc";
  size?: number;
  className?: string;
}

const TONE_VAR: Record<"accent" | "btc", string> = {
  accent: "var(--ct-accent)",
  btc: "var(--ct-asset-btc)",
};

export function BitcoinOrb({ tone = "accent", size = 132, className }: BitcoinOrbProps) {
  return (
    <div
      className={`dash-orb${className ? ` ${className}` : ""}`}
      style={{ ["--orb-size" as string]: `${size}px`, ["--orb-color" as string]: TONE_VAR[tone] }}
      aria-hidden
    >
      <svg viewBox="0 0 120 120" role="presentation">
        {/* Outer ring + satellite */}
        <g className="dash-orb-ring dash-orb-ring--outer">
          <circle cx="60" cy="60" r="52" strokeWidth="1" strokeDasharray="2 6" />
          <circle className="dash-orb-sat" cx="60" cy="8" r="2.4" />
        </g>

        {/* Mid ring + satellite */}
        <g className="dash-orb-ring dash-orb-ring--mid">
          <circle cx="60" cy="60" r="40" strokeWidth="1" strokeDasharray="1 4" opacity="0.8" />
          <circle className="dash-orb-sat" cx="100" cy="60" r="1.8" />
        </g>

        {/* Inner ring */}
        <g className="dash-orb-ring dash-orb-ring--inner">
          <circle cx="60" cy="60" r="28" strokeWidth="1.25" />
        </g>

        {/* Core + ₿ glyph */}
        <circle className="dash-orb-core" cx="60" cy="60" r="20" />
        <text
          className="dash-orb-glyph"
          x="60"
          y="61"
          textAnchor="middle"
          dominantBaseline="central"
          fontSize="22"
        >
          ₿
        </text>
      </svg>
    </div>
  );
}
