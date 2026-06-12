/** Client + server safe — true when PrivyProvider mounts a real context. */
export function isPrivyConfigured(): boolean {
  return (process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "").length > 0;
}
