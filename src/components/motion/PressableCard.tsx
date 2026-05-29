"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { useMotionConfig } from "./config";

type PressableCardProps = HTMLMotionProps<"div">;

export function PressableCard({
  children,
  className,
  ...props
}: PressableCardProps) {
  const { reduced, tapScale, hoverY, spring } = useMotionConfig();

  return (
    <motion.div
      className={className}
      whileHover={reduced ? undefined : { y: hoverY }}
      whileTap={reduced ? undefined : { scale: tapScale }}
      transition={spring}
      {...props}
    >
      {children}
    </motion.div>
  );
}

type PressableChipProps = HTMLMotionProps<"button"> & {
  as?: "button" | "span";
};

export function PressableChip({
  children,
  className,
  as = "span",
  ...props
}: PressableChipProps) {
  const { reduced, tapScale, spring } = useMotionConfig();
  const Component = as === "button" ? motion.button : motion.span;

  return (
    <Component
      className={className}
      whileHover={
        reduced
          ? undefined
          : { scale: 1.03, borderColor: "rgba(201, 169, 98, 0.45)" }
      }
      whileTap={reduced ? undefined : { scale: tapScale }}
      transition={spring}
      {...props}
    >
      {children}
    </Component>
  );
}
