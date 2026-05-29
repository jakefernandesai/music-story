"use client";

import { motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { ArtworkImage } from "@/components/ArtworkImage";
import { FadeIn, SlideUp, useMotionConfig } from "@/components/motion";
import { formatArtists, formatDuration } from "@/lib/format";

type TrackHeroProps = {
  track: Track;
};

export function TrackHero({ track }: TrackHeroProps) {
  const { reduced, slow, spring } = useMotionConfig();
  const releaseYearLabel =
    track.releaseYear > 0 ? track.releaseYear.toString() : "—";

  return (
    <section className="-mx-5 sm:mx-0">
      <div className="relative overflow-hidden sm:rounded-3xl">
        {/* Ambient glow from artwork */}
        <div className="pointer-events-none absolute -inset-8 z-0 opacity-70" aria-hidden>
          <motion.div
            className="absolute inset-0 scale-110 blur-3xl"
            initial={reduced ? { opacity: 0.5 } : { opacity: 0, scale: 1.05 }}
            animate={{ opacity: 0.55, scale: 1.12 }}
            transition={{ duration: slow, ease: [0.22, 1, 0.36, 1] }}
          >
            <ArtworkImage
              src={track.artworkUrl}
              alt=""
              sizes="480px"
              className="object-cover opacity-80"
            />
          </motion.div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(201,169,98,0.18)_0%,transparent_70%)]" />
        </div>

        <div className="relative z-10 aspect-[4/5] w-full sm:aspect-square">
          <motion.div
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0, scale: 1.06 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: slow, ease: [0.22, 1, 0.36, 1] }}
          >
            <ArtworkImage
              src={track.artworkUrl}
              alt={`${track.albumTitle} cover art`}
              sizes="(max-width: 768px) 100vw, 480px"
              priority
            />
          </motion.div>

          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/60 via-transparent to-transparent" />

          <SlideUp delay={0.15} className="absolute inset-x-0 bottom-0 p-6 pb-8">
            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.28em] text-accent">
              Now playing
            </p>
            <h1 className="font-display text-[2.5rem] font-medium leading-[1.05] tracking-tight">
              {track.title}
            </h1>
            <p className="mt-2 text-lg text-foreground/75">
              {formatArtists(track)}
            </p>
          </SlideUp>
        </div>

        <motion.div
          className="relative z-10 border-y border-border bg-surface/80 px-6 py-4 backdrop-blur-sm"
          initial={reduced ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...spring, delay: 0.25 }}
        >
          <dl className="grid grid-cols-3 gap-4 text-center">
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Album
              </dt>
              <dd className="mt-1 text-sm font-medium leading-snug">
                {track.albumTitle}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Year
              </dt>
              <dd className="mt-1 text-sm font-medium">{releaseYearLabel}</dd>
            </div>
            <div>
              <dt className="text-[10px] uppercase tracking-[0.18em] text-muted">
                Length
              </dt>
              <dd className="mt-1 text-sm font-medium">
                {formatDuration(track.durationMs)}
              </dd>
            </div>
          </dl>
        </motion.div>
      </div>

      <FadeIn delay={0.45} className="mt-6 text-center text-xs text-muted/80">
        Scroll to follow the thread
        <motion.span
          className="mt-1 block text-base leading-none"
          aria-hidden
          animate={reduced ? undefined : { y: [0, 4, 0] }}
          transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
        >
          ↓
        </motion.span>
      </FadeIn>
    </section>
  );
}
