"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { BentoLabel } from "@/components/catalyst/bento";
import { CockpitButton } from "@/components/catalyst/cockpit-button";
import { Select } from "@/components/catalyst/select";
import { saveQualification } from "@/app/admin/customers/[id]/actions";
import type { QualificationProfile } from "@prisma/client";
import { QUALIFICATION_FIELD_DEFINITIONS } from "@/lib/qualification/options";

interface SelectDef {
  name: keyof QualificationProfile & string;
  label: string;
  options: ReadonlyArray<[value: string, label: string]>;
}

const FIELDS: SelectDef[] = QUALIFICATION_FIELD_DEFINITIONS.map((field) => ({
  name: field.name,
  label: field.shortLabel,
  options: field.options.map((option) => [option.value, option.label]),
}));

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
    <form action={onSubmit} className="flex flex-col gap-5" aria-label="Qualification">
      <input type="hidden" name="userId" value={userId} />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {FIELDS.map((f) => {
          const current = profile ? (profile[f.name] as string | null) : null;
          return (
            <label key={f.name} className="flex flex-col gap-2" htmlFor={`qual-${f.name}`}>
              <BentoLabel>{f.label}</BentoLabel>
              <Select
                id={`qual-${f.name}`}
                name={f.name}
                defaultValue={current ?? ""}
              >
                <option value="">— unset —</option>
                {f.options.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </label>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <CockpitButton
          type="submit"
          variant="primary"
          shape="rect"
          size="lg"
          disabled={isPending}
        >
          {isPending ? "Saving…" : "Save & recalibrate"}
        </CockpitButton>
      </div>
    </form>
  );
}
