// design-sync shim for `next/link` — the DS bundle must be framework-free.
// Renders a plain <a>; the real Next.js Link drags the client router runtime
// (process.env.__NEXT_*) into the bundle, which throws in the browser.
import * as React from "react";

type LinkHref = string | { pathname?: string; href?: string };

export default function Link({
  href,
  children,
  ...rest
}: { href?: LinkHref; children?: React.ReactNode } & Record<string, unknown>) {
  const url =
    typeof href === "string" ? href : href?.href ?? href?.pathname ?? "#";
  return (
    <a href={url} {...(rest as Record<string, unknown>)}>
      {children}
    </a>
  );
}
