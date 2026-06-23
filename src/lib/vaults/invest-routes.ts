export type InvestStepId = "select" | "product" | "deposit" | "confirmed";

export const INVEST_SELECT_PATH = "/vaults" as const;

export function vaultSlug(idOrTicker: string): string {
  return idOrTicker.toLowerCase();
}

export function investProductPath(vaultIdOrTicker: string): string {
  return `/vaults/${vaultSlug(vaultIdOrTicker)}`;
}

export function investDepositPath(vaultIdOrTicker: string): string {
  return `${investProductPath(vaultIdOrTicker)}/invest`;
}

export function investConfirmedPath(vaultIdOrTicker: string): string {
  return `${investDepositPath(vaultIdOrTicker)}/confirmed`;
}
