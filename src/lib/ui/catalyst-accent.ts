/**
 * Accent fill for a Catalyst <Button>.
 *
 * Catalyst's `color="green"` is green-600 — it clashes with this project's
 * single accent (--ct-accent #A7FB90). Pass this className to a plain Catalyst
 * <Button> (no `color`) to keep the primitive's sizing/structure while driving
 * the fill from the project accent. Dark mode reads --btn-bg; the label sits on
 * the deep background.
 */
export const CATALYST_ACCENT_BTN =
  "text-[var(--ct-bg-deep)] [--btn-bg:var(--ct-accent)] [--btn-border:var(--ct-accent)] [--btn-hover-overlay:color-mix(in_srgb,var(--ct-bg-deep)_12%,transparent)] dark:text-[var(--ct-bg-deep)]";
