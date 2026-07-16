/**
 * @deprecated Tailwind Plus Button — use `CockpitButton` from `./cockpit-button` instead.
 *
 * This compatibility shim remains only for the design-system gallery specimens that
 * still import `Button` by name. New product/admin code MUST use CockpitButton.
 */

export { CockpitButton as Button, cockpitButtonVariants } from "./cockpit-button";
export { TouchTarget } from "./button-legacy-touch";
