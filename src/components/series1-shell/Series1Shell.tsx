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
 * it as a rounded, ringed card. The previous bespoke token layer (--s1-*, four
 * hand-rolled planes, shadow triplets) is gone: depth is Catalyst's, colour is
 * Tailwind's zinc ramp, and the Hearst accent survives as a signal only.
 */
export function Series1Shell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
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
  );
}
