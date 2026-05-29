"use client";

import { useReducedMotion } from "framer-motion";

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

export function useMotionConfig() {
  const reduced = useReducedMotion() ?? false;

  return {
    reduced,
    duration: reduced ? 0 : 0.55,
    fast: reduced ? 0 : 0.35,
    slow: reduced ? 0 : 0.75,
    stagger: reduced ? 0 : 0.09,
    staggerFast: reduced ? 0 : 0.06,
    spring: reduced
      ? { duration: 0 }
      : { type: "spring" as const, stiffness: 320, damping: 32 },
    tapScale: reduced ? 1 : 0.97,
    hoverY: reduced ? 0 : -2,
  };
}

export const fadeInVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const slideUpVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const staggerContainerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.04,
    },
  },
};
