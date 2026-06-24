import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
 * /admin/design-system — internal visual reference for the Cockpit design
 * system. The source of truth agents and future UI passes validate against:
 * approved foundations, layout primitives, core components, financial patterns,
 * states and anti-patterns — each rendered live from the real primitives.
 *
 * Pure static reference. No product data, no API/DB, no behaviour change. The
 * admin layout already gates the route (`session.role === "admin"`).
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
    <div className="admin-doc-shell--roomy">
      <AdminPageHeader
        titleLead="Design"
        titleAccent="System"
        contextLabel="Internal reference"
        description="The canonical visual reference for Hearst Connect. Open it before building or calibrating any surface: see the approved foundations, copy the right patterns, and check pages against the anti-patterns. Every example is rendered from the real primitives — not a mockup."
      />

      <nav aria-label="Design system sections" className="ds-index">
        {INDEX.map((s) => (
          <a key={s.id} href={`#${s.id}`} className="ds-index__link">
            <span className="ds-index__key">{s.key}</span>
            {s.label}
          </a>
        ))}
      </nav>

      <SectionFoundations />
      <SectionLayout />
      <SectionComponents />
      <SectionPatterns />
      <SectionStates />
      <SectionAntiPatterns />
    </div>
  );
}
