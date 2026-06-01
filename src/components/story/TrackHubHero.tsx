"use client";

import { motion } from "framer-motion";
import type { Track } from "@/lib/types";
import { ArtworkImage } from "@/components/ArtworkImage";
import { FadeIn, SlideUp, useMotionConfig } from "@/components/motion";
import { PreviewButton } from "@/components/preview/PreviewProvider";
import { formatArtists } from "@/lib/format";

type TrackHubHeroProps = {
  track: Track;
  worldDescription: string;
};

export function TrackHubHero({ track, worldDescription }: TrackHubHeroProps) {
  const { reduced, slow } = useMotionConfig();
  const trackId = track.spotifyId ?? track.id;
  const yearLabel =
    track.releaseYear > 0 ? String(track.releaseYear) : null;
  const albumLine = [track.albumTitle, yearLabel].filter(Boolean).join(" · ");

  return (
    <section aria-label="Track hub" className="-mx-5 sm:mx-0">
      <div className="relative overflow-hidden sm:rounded-3xl">
        <div className="pointer-events-none absolute -inset-10 z-0 opacity-80" aria-hidden>
          <motion.div
            className="absolute inset-0 scale-110 blur-3xl"
            initial={reduced ? { opacity: 0.45 } : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 0.5, scale: 1.1 }}
            transition={{ duration: slow, ease: [0.22, 1, 0.36, 1] }}
          >
            <ArtworkImage
              src={track.artworkUrl}
              alt=""
              sizes="480px"
              className="object-cover opacity-90"
            />
          </motion.div>
          <div className="world-hero-glow absolute inset-0" />
        </div>

        <div className="relative z-10 aspect-[4/5] w-full sm:aspect-[5/6]">
          <motion.div
            className="absolute inset-0"
            initial={reduced ? false : { opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: slow, ease: [0.22, 1, 0.36, 1] }}
          >
            <ArtworkImage
              src={track.artworkUrl}
              alt={`${track.title} cover art`}
              sizes="(max-width: 768px) 100vw, 480px"
              priority
            />
          </motion.div>

          <div className="world-hero-gradient-bottom absolute inset-0" />
          <div className="world-hero-gradient-top absolute inset-0" />

          <SlideUp
            delay={0.12}
            className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 pb-7"
          >
            <div className="min-w-0 flex-1">
              <h1 className="font-display text-[2.35rem] font-medium leading-[1.05] tracking-tight sm:text-[2.5rem]">
                {track.title}
              </h1>
              <p className="mt-2 text-lg text-foreground/80">
                {formatArtists(track)}
              </p>
              {albumLine && (
                <p className="mt-1.5 text-sm text-muted">{albumLine}</p>
              )}
            </div>
            <PreviewButton
              trackId={trackId}
              previewUrl={track.previewUrl}
              size="md"
            />
          </SlideUp>
        </div>
      </div>

      <FadeIn delay={0.28} className="mt-5 px-0.5 text-center sm:text-left">
        <p className="font-display text-base leading-relaxed text-foreground/88 sm:text-lg">
          {worldDescription}
        </p>
      </FadeIn>
    </section>
  );
}
