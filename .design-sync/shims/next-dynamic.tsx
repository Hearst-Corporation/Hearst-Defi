// design-sync shim for `next/dynamic` — keeps the DS bundle framework-free.
// Returns a passthrough that renders nothing until/unless the loader resolves;
// none of the synced primitives rely on dynamic loading for their visuals.
import * as React from "react";

export default function dynamic(
  _loader: unknown,
  _options?: unknown,
): React.ComponentType<Record<string, unknown>> {
  return function DynamicStub() {
    return null;
  };
}
