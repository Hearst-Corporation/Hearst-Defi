// Shared bento form class strings for the outreach admin forms.
//
// Pure className constants (no component, no logic) so the campaign / ICP /
// prospect / direct-send forms render identical bento fields: a tokenized
// sub-surface input with a hairline border and accent-green focus ring, a
// micro uppercase label, and a vertical field stack. Kept here as one source
// of truth instead of repeating the literals in every form island. 100% --ct-*.

/** Field stack: label above control, small gap. */
export const BENTO_FIELD = "flex flex-col gap-1.5";

/** Micro uppercase field label. */
export const BENTO_FIELD_LABEL = "ct-bento-label";

/** Sub-surface input/select/textarea: inset surface, hairline border, accent focus. */
export const BENTO_INPUT =
  "w-full rounded-lg border border-[var(--ct-border)] bg-[var(--ct-surface-inset)] px-4 py-2.5 text-[length:var(--ct-text-sm)] text-[var(--ct-text-strong)] placeholder:text-[var(--ct-text-faint)] transition-colors focus:border-[var(--ct-border-accent)] focus:outline-none";
