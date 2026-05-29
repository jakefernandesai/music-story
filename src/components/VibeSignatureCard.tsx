"use client";

import { motion } from "framer-motion";
import type { VibeSignature } from "@/lib/types";
import {
  FadeIn,
  SlideUp,
  StaggerGroup,
  StaggerItem,
  useMotionConfig,
} from "@/components/motion";

type VibeSignatureCardProps = {
  vibeSignature: VibeSignature | null;
};

function AnimatedScoreBar({
  score,
  isStrongest,
  delay,
}: {
  score: number;
  isStrongest: boolean;
  delay: number;
}) {
  const { reduced, duration } = useMotionConfig();
  const width = `${Math.round(score)}%`;

  return (
    <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/60">
      <motion.div
        className={`h-full rounded-full ${isStrongest ? "bg-accent shadow-[0_0_12px_rgba(201,169,98,0.5)]" : "bg-accent/70"}`}
        initial={reduced ? { width } : { width: "0%" }}
        animate={{ width }}
        transition={{ duration, delay, ease: [0.22, 1, 0.36, 1] }}
      />
    </div>
  );
}

export function VibeSignatureCard({ vibeSignature }: VibeSignatureCardProps) {
  const { reduced } = useMotionConfig();

  if (!vibeSignature) {
    return (
      <FadeIn>
        <section className="rounded-3xl border border-dashed border-border bg-surface/40 px-6 py-5">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted">
            Vibe signature
          </p>
          <p className="mt-2 text-sm text-muted">
            Last.fm taste data unavailable — add LASTFM_API_KEY to enable vibe
            profiling.
          </p>
        </section>
      </FadeIn>
    );
  }

  const strongestScore = Math.max(
    ...vibeSignature.topDimensions.map((d) => d.score),
  );

  return (
    <FadeIn>
      <section className="relative overflow-hidden rounded-3xl border border-border bg-surface px-6 py-5">
        <div
          className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-3xl"
          aria-hidden
        />

        <p className="text-xs font-medium uppercase tracking-[0.2em] text-accent">
          Vibe signature
        </p>

        <StaggerGroup className="mt-3 flex flex-wrap gap-2" delayChildren={0.12}>
          {vibeSignature.labels.map((label, index) => {
            const isStrongest = index === 0;
            return (
              <StaggerItem key={label}>
                <motion.span
                  className="inline-block rounded-full border border-accent/25 bg-accent/10 px-3 py-1 text-xs font-medium capitalize text-accent"
                  animate={
                    isStrongest && !reduced
                      ? {
                          boxShadow: [
                            "0 0 0px rgba(201,169,98,0)",
                            "0 0 16px rgba(201,169,98,0.35)",
                            "0 0 0px rgba(201,169,98,0)",
                          ],
                        }
                      : undefined
                  }
                  transition={
                    isStrongest && !reduced
                      ? { duration: 2.8, repeat: Infinity, ease: "easeInOut" }
                      : undefined
                  }
                >
                  {label}
                </motion.span>
              </StaggerItem>
            );
          })}
        </StaggerGroup>

        <SlideUp delay={0.35}>
          <p className="mt-4 text-sm leading-relaxed text-foreground/90">
            {vibeSignature.sentence}
          </p>
        </SlideUp>

        <StaggerGroup className="mt-4 grid gap-2 sm:grid-cols-3" delayChildren={0.2}>
          {vibeSignature.topDimensions.map((dimension, index) => {
            const isStrongest = dimension.score === strongestScore;
            return (
              <StaggerItem key={dimension.dimension}>
                <div
                  className={`rounded-2xl border px-3 py-2.5 ${
                    isStrongest
                      ? "border-accent/30 bg-accent/5"
                      : "border-border/60 bg-surface-elevated/40"
                  }`}
                >
                  <p className="text-[10px] uppercase tracking-wider text-muted">
                    {dimension.label}
                  </p>
                  <p className="mt-0.5 text-lg font-medium tabular-nums">
                    {Math.round(dimension.score)}
                    <span className="ml-1.5 text-xs font-normal text-muted">
                      {dimension.tier}
                    </span>
                  </p>
                  <AnimatedScoreBar
                    score={dimension.score}
                    isStrongest={isStrongest}
                    delay={0.25 + index * 0.08}
                  />
                </div>
              </StaggerItem>
            );
          })}
        </StaggerGroup>
      </section>
    </FadeIn>
  );
}
