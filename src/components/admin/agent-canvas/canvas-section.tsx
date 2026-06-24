"use client";

import type { CanvasSection, Provenance } from "@/lib/canvas/contract";
import { ProvenanceBadge, type Provenance as BadgeProvenance } from "@/components/ui/provenance-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

import { CanvasActionButton } from "./canvas-action-button";

/**
 * Pure section renderer. Displays provenance-tagged fields, the agent's options
 * (pre-fill chat / set field — never a write), and any HITL action proposals as
 * `CanvasActionButton`s (the ONLY components that touch the network).
 */

function toBadgeProvenance(p: Provenance): BadgeProvenance {
  // Canvas contract is capitalized; the badge union is lowercase. The mapping is
  // exact for the six canvas provenances.
  return p.toLowerCase() as BadgeProvenance;
}

export function CanvasSectionView({
  canvasId,
  section,
  agentLive,
  onPrefillChat,
  onSetField,
}: {
  canvasId: string;
  section: CanvasSection;
  agentLive: boolean;
  onPrefillChat: (prompt: string) => void;
  onSetField: (sectionId: string, fieldKey: string, value: string) => void;
}) {
  return (
    <Card className={cn("ct-canvas-section", section.status === "building" && "ct-canvas-section--building")}>
      <div className="ct-canvas-section-head">
        <h3 className="h3 ct-canvas-section-title m-0">{section.title}</h3>
        {section.status === "building" && (
          <span className="ct-canvas-section-status">Composing…</span>
        )}
      </div>

      {section.intro && <p className="ct-canvas-section-intro">{section.intro}</p>}

      {section.fields.length > 0 && (
        <dl className="ct-canvas-fields">
          {section.fields.map((field) => (
            <div key={field.key} className="ct-canvas-field">
              <dt className="ct-canvas-field-label">
                {field.label}
                <ProvenanceBadge kind={toBadgeProvenance(field.provenance)} compact />
              </dt>
              <dd className="ct-canvas-field-value">{field.value}</dd>
              {field.note && <dd className="ct-canvas-field-note">{field.note}</dd>}
            </div>
          ))}
        </dl>
      )}

      {section.options.length > 0 && (
        <div className="ct-canvas-options">
          {section.options.map((opt) => (
            <Button
              key={opt.id}
              variant="ghost"
              size="sm"
              onClick={() => {
                if (opt.effect.kind === "prefill_chat") onPrefillChat(opt.effect.prompt);
                else onSetField(opt.effect.sectionId, opt.effect.fieldKey, opt.effect.value);
              }}
            >
              {opt.label}
            </Button>
          ))}
        </div>
      )}

      {section.actions.length > 0 && (
        <div className="ct-canvas-actions">
          {section.actions.map((action) => (
            <CanvasActionButton
              key={action.proposalId}
              canvasId={canvasId}
              proposal={action}
              disabled={!agentLive}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
