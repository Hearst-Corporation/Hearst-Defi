import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/cn";

export type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

// Bento chip (Portfolio canon) — tinted border + fill + text per status.
// Single accent green (#A7FB90) for success/accent; amber for warning; red for
// danger; neutral zinc for default/brand. API unchanged (28 consumers).
const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider leading-none transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-white/10 bg-white/5 text-zinc-400",
        success: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
        warning: "border-amber-400/30 bg-amber-400/10 text-amber-400",
        danger: "border-red-400/30 bg-red-400/10 text-red-400",
        accent: "border-[#A7FB90]/30 bg-[#A7FB90]/10 text-[#A7FB90]",
        brand: "border-white/10 bg-white/5 text-zinc-200",
        flat: "border-transparent bg-transparent shadow-none backdrop-blur-none font-medium normal-case tracking-normal px-0 py-0 gap-1",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}
