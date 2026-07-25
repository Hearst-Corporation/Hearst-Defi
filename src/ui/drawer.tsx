"use client";

import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import { cn } from "@/lib/cn";

export function Drawer({
  open,
  onClose,
  children,
  side = "right",
  className,
}: {
  open: boolean;
  onClose: (value: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right";
  className?: string;
}) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-(--z-overlay)">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity data-closed:opacity-0"
      />
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 overflow-hidden">
          <div
            className={cn(
              "pointer-events-none fixed inset-y-0 flex max-w-full",
              side === "right" ? "right-0" : "left-0",
            )}
          >
            <DialogPanel
              transition
              className={cn(
                "pointer-events-auto h-full w-screen max-w-md border-border bg-surface-raised shadow-[var(--ct-shadow-soft)]",
                side === "right" ? "border-l" : "border-r",
                "transition duration-300 data-closed:translate-x-full",
                side === "left" && "data-closed:-translate-x-full",
                className,
              )}
            >
              {children}
            </DialogPanel>
          </div>
        </div>
      </div>
    </HeadlessDialog>
  );
}

export { DialogTitle as DrawerTitle };
