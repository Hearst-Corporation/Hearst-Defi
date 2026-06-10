import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdvancedModeToggle } from "@/components/admin/advanced-mode-toggle";
import {
  VaultSelector,
  type VaultSelectorOption,
} from "@/components/admin/vault-selector";
import { cn } from "@/lib/cn";

/**
 * Dashboard page chrome — title row + vault/mode controls on a dedicated toolbar
 * row (not crammed into AdminPageHeader actions).
 */
export function DashboardToolbar({
  vaultName,
  vaultId,
  vaultIsPreset,
  mode,
  vaultOptions,
  className,
}: {
  vaultName: string;
  vaultId: string;
  vaultIsPreset: boolean;
  mode: "simple" | "advanced";
  vaultOptions: VaultSelectorOption[];
  className?: string;
}) {
  return (
    <AdminPageHeader
      className={className}
      title="Dashboard"
      description={
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-medium ct-text-primary">{vaultName}</span>
          {vaultIsPreset ? (
            <span
              className="ct-pill text-micro uppercase tracking-wide ct-text-faint"
              title="Preset only · values from engine fixture, not live data"
            >
              preset
            </span>
          ) : null}
        </span>
      }
    >
      <div
        className={cn(
          "flex flex-col gap-3 border-b border-[var(--ct-border-soft)] pb-4",
          "lg:flex-row lg:items-center lg:justify-between",
        )}
      >
        <div className="ct-seg-scroll min-w-0 flex-1">
          <VaultSelector
            active={vaultId}
            options={vaultOptions}
            preserveParams={
              mode === "advanced" ? { mode: "advanced" } : undefined
            }
          />
        </div>
        <div className="shrink-0">
          <AdvancedModeToggle active={mode} vaultId={vaultId} />
        </div>
      </div>
    </AdminPageHeader>
  );
}
