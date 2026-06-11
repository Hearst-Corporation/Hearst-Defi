"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/cn";

interface MotionViewportProps extends HTMLMotionProps<"div"> {
  children: React.ReactNode;
  delay?: number;
}

/**
 * A wrapper component that animates its children when they enter the viewport.
 * Uses the project's standard duration and easing.
 */
export function MotionViewport({
  children,
  className,
  delay = 0,
  ...props
}: MotionViewportProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.4, // var(--ct-dur-base) is usually around 0.2-0.4s
        delay,
        ease: [0.23, 1, 0.32, 1], // Approximating var(--ct-ease) if not directly accessible in JS
      }}
      className={cn(className)}
      {...props}
    >
      {children}
    </motion.div>
  );
}
