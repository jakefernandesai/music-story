"use client";

import { motion } from "framer-motion";
import type { ReleaseWorld, Track } from "@/lib/types";
import { ArtworkImage } from "@/components/ArtworkImage";
import { FadeIn, SlideUp, useMotionConfig } from "@/components/motion";
import { PreviewButton, PreviewProvider } from "@/components/preview/PreviewProvider";
import { formatArtists, formatDuration } from "@/lib/format";
import { releaseWorldIsRich } from "@/lib/story-context-utils";

type TrackFeatureProps = {
  track: Track;
  releaseWorld?: ReleaseWorld | null;
  variant?: "default" | "compact";
};

export function TrackFeature({ track, releaseWorld, variant = "default" }: TrackFeatureProps) {
  const { reduced, slow, spring } = useMotionConfig();
  const releaseYearLabel =
    track.releaseYear > 0 ? track.releaseYear.toString() : "—";
  const showInlineRelease = releaseWorld && !releaseWorldIsRich(releaseWorld);
  const trackId = track.spotifyId ?? track.id;
  const compact = variant === "compact";

  if (compact) {
    return (
      <PreviewProvider>
        <section aria-label="Track details" className="rounded-xl border border-border/40 bg-surface/40 p-4">
          <div className="flex gap-3">
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg">
              <ArtworkImage src={track.artworkUrl} alt="" sizes="56px" className="object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-medium leading-tight">{track.title}</h2>
              <p className="text-sm text-muted">{formatArtists(track)}</p>
              <dl className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <div>{track.albumTitle}</div>
                <div>{releaseYearLabel}</div>
                <div>{formatDuration(track.durationMs)}</div>
              </dl>
            </div>
            <PreviewButton trackId={trackId} previewUrl={track.previewUrl} size="sm" />
          </div>
        </section>
      </PreviewProvider>
    );
  }

  return (
    <PreviewProvider>
      <section aria-label="The track" className="-mx-5 sm:mx-0">
        <FadeIn>
          <p className="mb-3 px-5 text-[10px] font-medium uppercase tracking-[0.28em] text-accent sm:px-0">
            The track
          </p>
        </FadeIn>

        <div className="relative overflow-hidden sm:rounded-3xl">
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
          </div>

          <div className="relative z-10 flex gap-4 p-5 sm:p-6">
            <motion.div
              className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-[0_0_32px_-8px_rgba(201,169,98,0.35)] sm:h-36 sm:w-36"
              initial={reduced ? false : { opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: slow, ease: [0.22, 1, 0.36, 1] }}
            >
              <ArtworkImage
                src={track.artworkUrl}
                alt={`${track.albumTitle} cover`}
                sizes="144px"
                priority
              />
            </motion.div>

            <SlideUp delay={0.1} className="min-w-0 flex-1">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <h1 className="font-display text-2xl font-medium leading-tight tracking-tight sm:text-3xl">
                    {track.title}
                  </h1>
                  <p className="mt-1.5 text-base text-foreground/75">
                    {formatArtists(track)}
                  </p>
                </div>
                <PreviewButton trackId={trackId} previewUrl={track.previewUrl} />
              </div>

              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Album</dt>
                  <dd className="mt-0.5 font-medium leading-snug">{track.albumTitle}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Year</dt>
                  <dd className="mt-0.5 font-medium">{releaseYearLabel}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider text-muted">Length</dt>
                  <dd className="mt-0.5 font-medium">{formatDuration(track.durationMs)}</dd>
                </div>
              </dl>

              {showInlineRelease && releaseWorld?.label && (
                <p className="mt-3 text-xs text-muted">
                  {releaseWorld.label}
                  {releaseWorld.catalogNumber
                    ? ` · ${releaseWorld.catalogNumber}`
                    : ""}
                </p>
              )}
            </SlideUp>
          </div>

          <motion.div
            className="relative z-10 border-t border-border/60 bg-surface/70 px-5 py-3 backdrop-blur-sm sm:px-6"
            initial={reduced ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...spring, delay: 0.2 }}
          >
            <p className="text-xs text-muted/80">
              Anchor track — more details below.
            </p>
          </motion.div>
        </div>
      </section>
    </PreviewProvider>
  );
}
