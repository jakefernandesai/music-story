"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { EASE_OUT, useMotionConfig } from "./config";

type StaggerGroupProps = HTMLMotionProps<"div"> & {
  stagger?: number;
  delayChildren?: number;
};

export function StaggerGroup({
  children,
  className,
  stagger,
  delayChildren = 0.04,
  ...props
}: StaggerGroupProps) {
  const { reduced, stagger: defaultStagger } = useMotionConfig();

  return (
    <motion.div
      className={className}
      initial={reduced ? "visible" : "hidden"}
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: stagger ?? defaultStagger,
            delayChildren,
          },
        },
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  ...props
}: HTMLMotionProps<"div">) {
  const { reduced, duration } = useMotionConfig();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 },
        visible: { opacity: 1, y: 0 },
      }}
      transition={{ duration, ease: EASE_OUT }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
