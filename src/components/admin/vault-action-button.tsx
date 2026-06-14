"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

type ButtonVariant = "primary" | "secondary" | "danger";
type ConfirmVariant = "primary" | "danger";

export interface VaultActionButtonProps {
  label: string;
  variant: ButtonVariant;
  size?: "sm" | "md" | "lg";
  confirm: {
    title: string;
    description?: ReactNode;
    confirmLabel: string;
    confirmVariant?: ConfirmVariant;
    /** Si fourni, l'utilisateur doit retaper exactement cette valeur. */
    confirmPhrase?: string;
  };
  /** Server Action déjà bindée à l'id côté Server Component. */
  action: () => Promise<void>;
}

export function VaultActionButton({
  label,
  variant,
  size = "md",
  confirm,
  action,
}: VaultActionButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant={variant} size={size} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={confirm.title}
        description={confirm.description}
        confirmLabel={confirm.confirmLabel}
        confirmVariant={confirm.confirmVariant}
        confirmPhrase={confirm.confirmPhrase}
        onConfirm={action}
      />
    </>
  );
}
