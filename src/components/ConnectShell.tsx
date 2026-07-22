"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

import { KycAppShell } from "@/components/catalyst/kyc-app-shell";
import { Series1Shell } from "@/components/series1-shell/Series1Shell";

export function ConnectShell({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const admin = pathname.startsWith("/admin");

  if (admin) {
    return <KycAppShell>{children}</KycAppShell>;
  }

  return <Series1Shell>{children}</Series1Shell>;
}
