"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { saveQualification } from "@/app/admin/customers/[id]/actions";
import type { QualificationProfile } from "@prisma/client";

interface SelectDef {
  name: keyof QualificationProfile & string;
  label: string;
  options: ReadonlyArray<[value: string, label: string]>;
}

const FIELDS: SelectDef[] = [
  {
    name: "platformType",
    label: "Platform",
    options: [
      ["crypto", "Crypto company"],
      ["exchange", "Exchange"],
      ["wealth", "Wealth platform"],
      ["custody", "Custody / Infra"],
    ],
  },
  {
    name: "aum",
    label: "AUM",
    options: [
      ["lt_10m", "< $10M"],
      ["10_50m", "$10M–$50M"],
      ["50_250m", "$50M–$250M"],
      ["250m_plus", "$250M+"],
      ["unsure", "Not sure"],
    ],
  },
  {
    name: "fundsUsage",
    label: "Funds usage",
    options: [
      ["idle", "Mostly idle"],
      ["mix", "A mix"],
      ["earning", "Mostly earning"],
    ],
  },
  {
    name: "yieldStatus",
    label: "Yield product",
    options: [
      ["live", "Live"],
      ["in_progress", "In progress"],
      ["not_yet", "Not yet"],
    ],
  },
  {
    name: "yieldType",
    label: "Yield interest",
    options: [
      ["low_risk", "Low-risk"],
      ["balanced", "Balanced"],
      ["growth", "Growth"],
      ["unsure", "Not sure"],
    ],
  },
  {
    name: "vaultSize",
    label: "Vault size",
    options: [
      ["100_500k", "$100K–$500K"],
      ["500k_1m", "$500K–$1M"],
      ["1_5m", "$1M–$5M"],
      ["5m_plus", "$5M+"],
      ["unsure", "Not sure"],
    ],
  },
  {
    name: "timeline",
    label: "Timeline",
    options: [
      ["asap", "ASAP"],
      ["1_3m", "1–3 months"],
      ["3_6m", "3–6 months"],
      ["exploring", "Exploring"],
    ],
  },
];

/**
 * Manual editor for a customer's qualification (Typeform) answers. Saving
 * recalibrates the agent persona server-side (see saveQualification).
 */
export function QualificationForm({
  investorId,
  userId,
  profile,
}: {
  investorId: string;
  userId: string;
  profile: QualificationProfile | null;
}) {
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await saveQualification(investorId, formData);
        toast.success("Qualification saved — agent recalibrated");
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Save failed: ${message}`);
      }
    });
  }

  return (
    <form action={onSubmit} className="admin-doc-stack admin-doc-stack--actions" aria-label="Qualification">
      <input type="hidden" name="userId" value={userId} />
      <div className="admin-doc-form-grid-2">
        {FIELDS.map((f) => {
          const current = profile ? (profile[f.name] as string | null) : null;
          return (
            <label key={f.name} className="block body-xs" htmlFor={`qual-${f.name}`}>
              <span className="ct-form-label">{f.label}</span>
              <select
                id={`qual-${f.name}`}
                name={f.name}
                defaultValue={current ?? ""}
                className="ct-input"
              >
                <option value="">— unset —</option>
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
      </div>
      <div className="admin-doc-inline-row">
        <Button type="submit" variant="primary" disabled={isPending}>
          {isPending ? "Saving…" : "Save & recalibrate"}
        </Button>
      </div>
    </form>
  );
}
