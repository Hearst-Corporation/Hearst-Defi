// Shared bento form class strings for the outreach admin forms.
//
// Pure className constants (no component, no logic) so the campaign / ICP /
// prospect / direct-send forms render identical bento fields: a #15191C
// sub-surface input with a hairline border and accent-green focus ring, a
// micro uppercase label, and a vertical field stack. Kept here as one source
// of truth instead of repeating the literals in every form island.

/** Field stack: label above control, small gap. */
export const BENTO_FIELD = "flex flex-col gap-1.5";

/** Micro uppercase field label. */
export const BENTO_FIELD_LABEL =
  "text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-500";

/** Sub-surface input/select/textarea: #15191C, hairline border, accent focus. */
export const BENTO_INPUT =
  "w-full rounded-lg border border-white/10 bg-[#15191C] px-4 py-2.5 text-[13px] text-white placeholder:text-zinc-600 transition-colors focus:border-[#A7FB90]/40 focus:outline-none";
