"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE_OUT, fadeInVariants, useMotionConfig } from "./config";

type FadeInProps = HTMLMotionProps<"div"> & {
  delay?: number;
};

export function FadeIn({
  children,
  delay = 0,
  className,
  ...props
}: FadeInProps) {
  const { reduced, duration } = useMotionConfig();

  return (
    <motion.div
      className={className}
      initial={reduced ? "visible" : "hidden"}
      animate="visible"
      variants={fadeInVariants}
      transition={{ duration, delay, ease: EASE_OUT }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
