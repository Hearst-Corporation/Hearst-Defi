"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Navbar, NavbarSection, NavbarSpacer } from "@/components/catalyst/navbar";
import { SidebarLayout } from "@/components/catalyst/sidebar-layout";

import "./series1-tokens.css";
import { Series1Nav } from "./Series1Nav";

/**
 * Investor shell — Catalyst SidebarLayout, same structure and depth model as
 * the rest of the product: a dark page gutter with the content raised out of
 * it as a rounded, ringed card. Shell surface fusion (2026-07-23): colours
 * come from the `--ct-*` tokens — the `.s1-shell` wrapper lets
 * series1-tokens.css re-skin SidebarLayout's hard-coded zinc gutter/card
 * without forking the shared primitive.
 */
export function Series1Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="s1-shell">
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
            <NavbarSection />
          </Navbar>
        }
        sidebar={<Series1Nav pathname={pathname} />}
      >
        {children}
      </SidebarLayout>
    </div>
  );
}
