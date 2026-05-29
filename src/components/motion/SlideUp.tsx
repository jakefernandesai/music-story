"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE_OUT, slideUpVariants, useMotionConfig } from "./config";

type SlideUpProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

export function SlideUp({
  children,
  delay = 0,
  className,
  ...props
}: SlideUpProps) {
  const { reduced, duration } = useMotionConfig();

  return (
    <motion.div
      className={className}
      initial={reduced ? "visible" : "hidden"}
      animate="visible"
      variants={slideUpVariants}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
