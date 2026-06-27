"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Modal } from "@/components/ui/modal";
import {
  BENTO_PRIMARY_BTN,
  BENTO_SECONDARY_BTN,
} from "@/components/ui/bento";
import {
  BENTO_FIELD,
  BENTO_FIELD_LABEL,
  BENTO_INPUT,
} from "@/components/admin/outreach/bento-form";
import { createIcp, runSourcing } from "@/app/admin/outreach/actions";

/**
 * Inline "Define a distributor ICP" disclosure form. Creates an OutreachICP
 * (persona + Apollo filters) and, on success, immediately triggers a sourcing
 * run for it so the operator gets leads in one gesture.
 *
 * Sourcing is MOCK in Palier 0 (no Apollo credit spent) — the toast says so.
 * Nothing is sent; sourced leads land as `new` prospects, tiered by score.
 */
export function IcpForm() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const { id } = await createIcp(formData);
        const result = await runSourcing(id);
        const { sourced, isMock, byTier } = result;
        toast.success(
          `${isMock ? "Demo sourcing" : "Sourced"}: ${sourced} lead${
            sourced === 1 ? "" : "s"
          } · A:${byTier.A} B:${byTier.B} C:${byTier.C}`,
          {
            description: isMock
              ? "Demo leads (Apollo not wired yet) — review before any send."
              : "Review tiers before any send.",
          },
        );
        setOpen(false);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        toast.error(`Sourcing failed: ${message}`);
      }
    });
  }

  return (
    <>
      <button type="button" className={BENTO_PRIMARY_BTN} onClick={() => setOpen(true)}>
        Define a distributor ICP
      </button>

      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="Ideal Customer Profile — distributor"
        className="max-w-2xl"
      >
        <form
          action={onSubmit}
          className="flex flex-col gap-4"
          aria-label="Define an ideal customer profile"
        >
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="icp-name">
              <span className={BENTO_FIELD_LABEL}>Name</span>
              <input
                id="icp-name"
                name="name"
                type="text"
                required
                placeholder="US RIAs & family offices"
                className={BENTO_INPUT}
                autoFocus
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="icp-language">
              <span className={BENTO_FIELD_LABEL}>Email language</span>
              <select
                id="icp-language"
                name="language"
                defaultValue="en"
                className={BENTO_INPUT}
                aria-label="Email language"
              >
                <option value="en">English</option>
                <option value="fr">French</option>
              </select>
            </label>
          </div>
          <label className={BENTO_FIELD} htmlFor="icp-titles">
            <span className={BENTO_FIELD_LABEL}>
              Target titles (comma separated)
            </span>
            <input
              id="icp-titles"
              name="titles"
              type="text"
              placeholder="wealth manager, family office, RIA, IFA"
              className={BENTO_INPUT}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={BENTO_FIELD} htmlFor="icp-locations">
              <span className={BENTO_FIELD_LABEL}>Locations</span>
              <input
                id="icp-locations"
                name="locations"
                type="text"
                placeholder="United States, Switzerland, United Kingdom"
                className={BENTO_INPUT}
              />
            </label>
            <label className={BENTO_FIELD} htmlFor="icp-industries">
              <span className={BENTO_FIELD_LABEL}>Industries / keywords</span>
              <input
                id="icp-industries"
                name="industries"
                type="text"
                placeholder="wealth management, financial services"
                className={BENTO_INPUT}
              />
            </label>
          </div>
          <input type="hidden" name="persona" value="distributor" />
          <p className="m-0 text-[12px] text-zinc-400">
            Tier thresholds default to 85 / 60 / 40 (Prime / Warm / Cold). Sourcing
            finds, scores, and tiers leads — it never sends.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button type="submit" className={BENTO_PRIMARY_BTN} disabled={isPending}>
              {isPending ? "Sourcing…" : "Create & source leads"}
            </button>
            <button
              type="button"
              className={BENTO_SECONDARY_BTN}
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}
