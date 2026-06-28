/**
 * Legacy compatibility wrapper. New usage should import from
 * `@/components/catalyst/card`.
 *
 * The canonical implementation now lives in Catalyst; this module only re-exports
 * it so the ~existing `@/components/ui/card` call sites keep working unchanged
 * during the Catalyst absorption migration (MISSION #043). No autonomous visual
 * component lives here anymore.
 */

export { Card, CardHeader, CardTitle } from "@/components/catalyst/card";
