import "server-only";

/** Persona embed is active when a template id is configured at build time. */
export function isPersonaConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PERSONA_TEMPLATE_ID ?? "").length > 0;
}

/** Privy wallet connect is active when the public app id is set. */
export function isPrivyConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").length > 0;
}

export function personaEnvironment(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PERSONA_ENVIRONMENT === "production"
    ? "production"
    : "sandbox";
}
