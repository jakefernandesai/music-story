"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FadeIn, useMotionConfig } from "@/components/motion";

const LOADING_STAGES = [
  "Reading metadata",
  "Tracing scenes",
  "Mapping the vibe",
  "Building recommendations",
] as const;

function OrbitRadar() {
  const { reduced } = useMotionConfig();

  if (reduced) {
    return (
      <div
        className="relative mx-auto h-28 w-28 rounded-full border border-accent/30"
        aria-hidden
      />
    );
  }

  return (
    <div className="relative mx-auto h-28 w-28" aria-hidden>
      {/* Outer ring */}
      <motion.div
        className="absolute inset-0 rounded-full border border-accent/20"
        animate={{ scale: [1, 1.08, 1], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Rotating sweep */}
      <motion.div
        className="absolute inset-2 rounded-full border border-dashed border-accent/15"
        animate={{ rotate: 360 }}
        transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
      />
      {/* Orbiting dot */}
      <motion.div
        className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_rgba(201,169,98,0.6)]"
        animate={{ rotate: 360 }}
        style={{ transformOrigin: "50% 3.5rem" }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      {/* Inner pulse */}
      <motion.div
        className="absolute inset-8 rounded-full bg-accent/10"
        animate={{ scale: [0.85, 1, 0.85], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {/* Center core */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="h-3 w-3 rounded-full bg-accent/80"
          animate={{ opacity: [0.6, 1, 0.6] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
}

export default function StoryLoading() {
  const [stageIndex, setStageIndex] = useState(0);
  const { reduced } = useMotionConfig();

  useEffect(() => {
    if (reduced) return;
    const interval = setInterval(() => {
      setStageIndex((current) => (current + 1) % LOADING_STAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [reduced]);

  return (
    <div className="flex flex-col items-center gap-10 pb-16 pt-8">
      <FadeIn className="w-full">
        <p className="text-center text-[10px] font-medium uppercase tracking-[0.3em] text-muted">
          Music Story
        </p>
      </FadeIn>

      <div className="flex w-full flex-col items-center gap-8">
        <OrbitRadar />

        <div className="text-center">
          <h2 className="font-display text-2xl font-medium tracking-tight">
            Analysing track
          </h2>
          <motion.p
            key={LOADING_STAGES[stageIndex]}
            className="mt-3 text-sm text-accent/90"
            initial={reduced ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            aria-live="polite"
          >
            {LOADING_STAGES[stageIndex]}…
          </motion.p>
        </div>

        {/* Progress dots */}
        <div className="flex gap-2" aria-hidden>
          {LOADING_STAGES.map((_, index) => (
            <motion.div
              key={index}
              className={`h-1 rounded-full ${index === stageIndex ? "w-6 bg-accent" : "w-1 bg-border"}`}
              animate={
                reduced
                  ? undefined
                  : { opacity: index === stageIndex ? 1 : 0.35 }
              }
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>
      </div>

      {/* Subtle ambient glow */}
      <div
        className="pointer-events-none fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-accent/5 to-transparent"
        aria-hidden
      />
    </div>
  );
}
