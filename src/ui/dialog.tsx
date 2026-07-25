"use client";

import {
  Dialog as HeadlessDialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from "@headlessui/react";

import { cn } from "@/lib/cn";

export function Dialog({
  open,
  onClose,
  children,
  className,
}: {
  open: boolean;
  onClose: (value: boolean) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <HeadlessDialog open={open} onClose={onClose} className="relative z-(--z-overlay)">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity data-closed:opacity-0"
      />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className={cn(
            "w-full max-w-lg rounded-xl border border-border bg-surface-raised p-6 shadow-md",
            "transition-all data-closed:scale-95 data-closed:opacity-0",
            className,
          )}
        >
          {children}
        </DialogPanel>
      </div>
    </HeadlessDialog>
  );
}

export function DialogHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mb-4 space-y-1", className)} {...props} />;
}

export { DialogTitle };

export function DialogBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("text-sm text-muted", className)} {...props} />;
}

export function DialogFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("mt-6 flex flex-wrap justify-end gap-2", className)}
      {...props}
    />
  );
}
