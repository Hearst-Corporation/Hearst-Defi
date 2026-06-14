// Demo Provider guard — fail-closed.
//
// The demo provider must NEVER run in production (even if the flag is set), and
// stays OFF by default everywhere else: a non-production environment must opt in
// explicitly via DEMO_PROVIDER_ENABLED=1. A missing NODE_ENV is treated as
// production (fail-closed). Pure (params injected) so it is unit-testable
// without mutating process.env.

export function canRunDemoProvider(
  nodeEnv: string | undefined = process.env.NODE_ENV,
  enableFlag: string | undefined = process.env.DEMO_PROVIDER_ENABLED,
): boolean {
  // Missing env → fail-closed (assume production).
  if (!nodeEnv) return false;
  // Production is off even with the flag set.
  if (nodeEnv === "production") return false;
  // Any non-production environment requires the explicit opt-in flag.
  return enableFlag === "1";
}
