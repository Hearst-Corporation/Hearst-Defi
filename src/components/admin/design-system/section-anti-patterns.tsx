import { Card } from "@/components/ui/card";
import { Metric } from "@/components/ui/metric";
import { NestedPanel } from "@/components/ui/nested-panel";

import { DsAntiCard, DsBlock, DsDoDont, DsSection } from "./ds-kit";

const ANTI_PATTERNS = [
  {
    title: "Glow / halo",
    why: "Box-shadow blooms or accent halos on panels read as a toy, not an institution.",
    fix: "use 1px graphite border + surface tiers; depth comes from elevation tokens, not blur.",
  },
  {
    title: "Radial highlight",
    why: "Radial-gradient spotlights behind content fight the global ambient light.",
    fix: "keep panels flat on --ct-surface-*; the shell owns the one ambient halo.",
  },
  {
    title: "Green wash",
    why: "Tinting whole surfaces or text green breaks the one-accent rule.",
    fix: "reserve --ct-accent for one action / one KPI; differentiate with blue / amber.",
  },
  {
    title: "Cage-in-cage",
    why: "Panel nested in panel doubles borders into a visual cage.",
    fix: 'switch the parent to material="flat", then nest a single NestedPanel.',
  },
  {
    title: "Fake-data skeleton",
    why: "Skeletons drawn to look like populated numbers read as real data on load.",
    fix: "use plain Skeleton bars — structure only, obviously a placeholder.",
  },
  {
    title: "Giant hero chart",
    why: "A chart that fills the viewport buries the numbers it is meant to support.",
    fix: "cap charts in a bounded container; the KPI leads, the chart supports.",
  },
  {
    title: "Illegible microtext",
    why: "Sub-9px or low-contrast faint text on faint surface can't be read.",
    fix: "floor at .body-xs (13px) on a legible text token (muted, not faint).",
  },
  {
    title: "Double badges",
    why: "Two status pills on one row (e.g. Live + Verified) compete and confuse.",
    fix: "one provenance badge per metric; merge meaning into a single chip.",
  },
  {
    title: "Dead empty card",
    why: "An empty glass card with no message looks broken, not intentional.",
    fix: "render EmptySurface with an honest message + next step.",
  },
  {
    title: "Height-forcing chart",
    why: "Charts with a hard min-height push the page into needless scroll.",
    fix: "let the container size the chart; size to content, not to a magic number.",
  },
  {
    title: "Excessive nesting",
    why: "Three+ nested surfaces create deep boxes and wasted padding.",
    fix: "max two levels: Card (active) → NestedPanel (evidence).",
  },
  {
    title: "Hardcoded colours",
    why: "Raw hex / rgb / Tailwind green-* can't be re-themed and drift from canon.",
    fix: "only var(--ct-*) tokens; CI forbids raw colour in src/**.",
  },
] as const;

export function SectionAntiPatterns() {
  return (
    <DsSection
      id="anti-patterns"
      index="F"
      title="Anti-patterns — do not use"
      lead="The regressions this page exists to stop. These are described, not rendered — the reference page itself carries no glow, halo, radial highlight or hardcoded colour."
    >
      <DsBlock title="Do not use" hint="If a page does any of these, it fails review">
        <div className="ds-anti-grid">
          {ANTI_PATTERNS.map((ap) => (
            <DsAntiCard key={ap.title} {...ap} />
          ))}
        </div>
      </DsBlock>

      <DsBlock title="Worked example — cage-in-cage" hint="Same content, right vs wrong surface nesting">
        <div className="ds-dodont">
          <DsDoDont tone="do" title="Flat parent + one nested panel">
            <Card hoverOverlay={false} material="flat" className="w-full">
              <NestedPanel>
                <Metric variant="nested" label="NAV" value="$12.40M" sublabel="USDC" />
              </NestedPanel>
            </Card>
            <p className="body-xs ct-text-muted m-0">
              One active surface, one evidence surface. Borders read as a single
              clean hierarchy.
            </p>
          </DsDoDont>
          <DsDoDont tone="dont" title="Glass inside glass inside glass">
            <Card hoverOverlay={false} className="w-full">
              <Card hoverOverlay={false} className="w-full">
                <NestedPanel>
                  <Metric variant="nested" label="NAV" value="$12.40M" sublabel="USDC" />
                </NestedPanel>
              </Card>
            </Card>
            <p className="body-xs ct-text-muted m-0">
              Stacked glass doubles bevels and borders into a cage — exactly what
              the flat material exists to avoid.
            </p>
          </DsDoDont>
        </div>
      </DsBlock>

      <DsBlock title="Ambient glow — shell only" hint="V4 energy = accent + data typography + chart language, not a glow on every card">
        <div className="ds-dodont">
          <DsDoDont tone="do" title="Light on the shell, flat opaque cards">
            <Card hoverOverlay={false} className="w-full">
              <Metric variant="nested" label="NAV" value="$12.40M" sublabel="USDC" />
            </Card>
            <p className="body-xs ct-text-muted m-0">
              The one ambient halo lives on the shell behind the modules. Cards stay
              flat opaque charcoal — the figures read clean, the green stays an accent.
            </p>
          </DsDoDont>
          <DsDoDont tone="dont" title="Glow / box-shadow as a card fill">
            <p className="body-xs ct-text-muted m-0">
              An accent box-shadow or radial bloom poured into a content card turns it
              into a glowing cage and drowns the data. Reserve --ct-glow-* for brief
              focus / hover states — never to dress a dense surface.
            </p>
          </DsDoDont>
        </div>
      </DsBlock>
    </DsSection>
  );
}
