/** Display name from email local-part (portfolio greeting pattern). */
export function profileDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "Investor";
  return local.charAt(0).toUpperCase() + local.slice(1);
}
