import {
  AdminPageShell,
  AdminSectionCard,
} from "@/components/admin/admin-page-shell";
import { SectionAntiPatterns } from "@/components/admin/design-system/section-anti-patterns";
import { SectionComponents } from "@/components/admin/design-system/section-components";
import { SectionFoundations } from "@/components/admin/design-system/section-foundations";
import { SectionLayout } from "@/components/admin/design-system/section-layout";
import { SectionPatterns } from "@/components/admin/design-system/section-patterns";
import { SectionStates } from "@/components/admin/design-system/section-states";

import "./design-system.css";

export const metadata = {
  title: "Design System — Hearst Connect",
};

/**
 * /admin/design-system — **living visual reference** for the Hearst Connect design
 * system. Open this page before building or calibrating any surface. Written canon
 * (`docs/DESIGN_SYSTEM.md`) is the checklist; **this rendered page wins** on surface
 * terminology and appearance (opaque graphite panels, not frosted glass).
 *
 * Pure static reference. No product data, no API/DB, no behaviour change. The
 * admin layout already gates the route (`session.role === "admin"`).
 *
 * Shell migrated to AdminPageShell + an intro AdminSectionCard (description +
 * section index). The six showcase `Section*` blocks render their own
 * `.ds-section` chrome and stay untouched below — wrapping each in a card would
 * be a card-in-card cage, so they flow directly in the shell stack instead.
 */

const INDEX = [
  { id: "foundations", key: "A", label: "Foundations" },
  { id: "layout", key: "B", label: "Layout" },
  { id: "components", key: "C", label: "Components" },
  { id: "patterns", key: "D", label: "Patterns" },
  { id: "states", key: "E", label: "States" },
  { id: "anti-patterns", key: "F", label: "Anti-patterns" },
] as const;

export default function AdminDesignSystemPage() {
  return (
    <AdminPageShell
      titleLead="Design"
      titleAccent="System"
      contextLabel="Internal reference"
    >
      <AdminSectionCard
        ariaLabel="Design system overview"
        title="Living reference"
        subtitle="Open before any UI work. Opaque graphite panels (not frosted glass), real primitives from src/components/ui, anti-patterns in section F. When this page and markdown disagree, this page wins."
      >
        <div className="px-5 pb-5">
          <nav aria-label="Design system sections" className="ds-index">
            {INDEX.map((s) => (
              <a key={s.id} href={`#${s.id}`} className="ds-index__link">
                <span className="ds-index__key">{s.key}</span>
                {s.label}
              </a>
            ))}
          </nav>
        </div>
      </AdminSectionCard>

      {/* Showcase sections — each renders its own `.ds-section` chrome; kept
          intact (no card wrapper) to avoid a card-in-card cage. */}
      <SectionFoundations />
      <SectionLayout />
      <SectionComponents />
      <SectionPatterns />
      <SectionStates />
      <SectionAntiPatterns />
    </AdminPageShell>
  );
}
