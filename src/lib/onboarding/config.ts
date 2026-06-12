import "server-only";

import { isPrivyConfigured } from "@/lib/auth/is-privy-configured";

export { isPrivyConfigured };

/** Persona embed is active when a template id is configured at build time. */
export function isPersonaConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID ?? "").length > 0;
}

export function personaEnvironment(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}
