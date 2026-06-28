"use client";

import type { CanvasSection, Provenance } from "@/lib/canvas/contract";
import { ProvenanceBadge, type Provenance as BadgeProvenance } from "@/components/ui/provenance-badge";
import {
  BentoHeader,
  BentoPanel,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
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
    <BentoPanel className={cn(section.status === "building" && "opacity-70")}>
      <BentoHeader
        as="h3"
        title={section.title}
        {...(section.intro ? { subtitle: section.intro } : {})}
        trailing={
          section.status === "building" ? (
            <span className="ct-bento-label">Composing…</span>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-5 p-5">
        {section.fields.length > 0 && (
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {section.fields.map((field) => (
              <div
                key={field.key}
                className="flex flex-col gap-1.5 rounded-lg border border-[var(--ct-border)] bg-surface-inset p-4"
              >
                <dt className="ct-bento-label flex items-center gap-2">
                  {field.label}
                  <ProvenanceBadge kind={toBadgeProvenance(field.provenance)} compact />
                </dt>
                <dd className="ct-metric-value m-0">{field.value}</dd>
                {field.note && (
                  <dd className="ct-metric-caption m-0">{field.note}</dd>
                )}
              </div>
            ))}
          </dl>
        )}

        {section.options.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {section.options.map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={BENTO_SECONDARY_BTN}
                onClick={() => {
                  if (opt.effect.kind === "prefill_chat") onPrefillChat(opt.effect.prompt);
                  else onSetField(opt.effect.sectionId, opt.effect.fieldKey, opt.effect.value);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {section.actions.length > 0 && (
          <div className="flex flex-col gap-3">
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
      </div>
    </BentoPanel>
  );
}
