"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE_OUT, useMotionConfig } from "./config";

type RevealOnScrollProps = HTMLMotionProps<"div"> & {
  delay?: number;
  y?: number;
};

export function RevealOnScroll({
  children,
  className,
  delay = 0,
  y = 24,
  ...props
}: RevealOnScrollProps) {
  const { reduced, duration } = useMotionConfig();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-8% 0px -5% 0px", amount: 0.2 }}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type RevealLineProps = {
  className?: string;
};

export function RevealLine({ className }: RevealLineProps) {
  const { reduced, slow } = useMotionConfig();

  return (
    <motion.div
      className={className}
      initial={reduced ? { scaleY: 1 } : { scaleY: 0 }}
      whileInView={{ scaleY: 1 }}
      viewport={{ once: true, margin: "-10% 0px" }}
      transition={{ duration: slow, ease: EASE_OUT }}
      style={{ transformOrigin: "top center" }}
      aria-hidden
    />
  );
}
