/**
 * Catalyst Link — wired to the Next.js App Router `next/link` (per Catalyst docs
 * "client-side router integration"). The shipped default rendered a bare <a>,
 * which violates this project's "next/link, never <a href>" rule. All Catalyst
 * components that render links (Button-as-link, Dropdown items, Pagination,
 * Sidebar/Navbar items…) funnel through THIS component, so wiring it once makes
 * the whole kit route-correct.
 */

import * as Headless from "@headlessui/react";
import NextLink, { type LinkProps } from "next/link";
import React, { forwardRef } from "react";

export const Link = forwardRef(function Link(
  props: LinkProps & React.ComponentPropsWithoutRef<"a">,
  ref: React.ForwardedRef<HTMLAnchorElement>,
) {
  return (
    <Headless.DataInteractive>
      <NextLink {...props} ref={ref} />
    </Headless.DataInteractive>
  );
});
