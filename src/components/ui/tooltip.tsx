"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}

export function Tooltip({
  content,
  children,
  className,
  side = "top",
}: TooltipProps) {
  const [isVisible, setIsVisible] = React.useState(false);

  const sideStyles = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: side === "top" ? 4 : -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: side === "top" ? 4 : -4 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className={cn(
              "absolute z-50 px-3 py-1.5 body-xs ct-text-strong",
              "bg-[var(--ct-surface-3)] border border-[var(--ct-border-soft)] rounded-md shadow-[var(--ct-shadow-soft)] backdrop-blur-md",
              "whitespace-nowrap pointer-events-none",
              sideStyles[side],
              className
            )}
          >
            {content}
            {/* Arrow */}
            <div
              className={cn(
                "absolute w-2 h-2 bg-[var(--ct-surface-3)] border-b border-r border-[var(--ct-border-soft)] rotate-45",
                side === "top" && "bottom-[-5px] left-1/2 -translate-x-1/2 border-t-0 border-l-0",
                side === "bottom" && "top-[-5px] left-1/2 -translate-x-1/2 border-b-0 border-r-0 border-t border-l",
                side === "left" && "right-[-5px] top-1/2 -translate-y-1/2 border-t border-l-0 border-b-0 border-r",
                side === "right" && "left-[-5px] top-1/2 -translate-y-1/2 border-b border-r-0 border-t-0 border-l"
              )}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
