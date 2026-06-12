import "server-only";

export interface IrContact {
  name: string;
  title: string;
  email: string;
  calendlyHref: string;
}

/**
 * Investor Relations contact — only returned when all public env vars are set.
 * No fabricated defaults.
 */
export function getIrContact(): IrContact | null {
  const name = process.env.NEXT_PUBLIC_IR_CONTACT_NAME?.trim();
  const email = process.env.NEXT_PUBLIC_IR_CONTACT_EMAIL?.trim();
  const calendlyHref = process.env.NEXT_PUBLIC_CALENDLY_URL?.trim();

  if (!name || !email || !calendlyHref) {
    return null;
  }

  const title = process.env.NEXT_PUBLIC_IR_CONTACT_TITLE?.trim() ?? "Investor Relations";

  return { name, title, email, calendlyHref };
}
