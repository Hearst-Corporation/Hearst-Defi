import type { ReactNode } from "react";
import { KycAppShell } from "@/components/catalyst/kyc-app-shell";

export function ConnectShell({
  children,
}: {
  children: ReactNode;
}) {
  return <KycAppShell>{children}</KycAppShell>;
}
