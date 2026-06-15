import type { ReactNode } from "react";

/** Vault switch enter animation — CSS-only (no client bailout). */
export function VaultTransition({
  children,
  vaultId,
}: {
  children: ReactNode;
  vaultId: string;
}) {
  return (
    <div key={vaultId} className="dashboard-vault-enter w-full">
      {children}
    </div>
  );
}
