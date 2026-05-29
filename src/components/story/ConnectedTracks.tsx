"use client";

import type { ConnectedSpotifyTrack } from "@/lib/types";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";
import { PreviewButton, PreviewProvider } from "@/components/preview/PreviewProvider";

type ConnectedTracksProps = {
  tracks: ConnectedSpotifyTrack[];
};

function ConnectedTrackRow({ track }: { track: ConnectedSpotifyTrack }) {
  return (
    <StaggerItem>
      <div className="flex items-center gap-2.5 rounded-xl border border-border/50 bg-surface-elevated/30 px-2.5 py-2">
        <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-md bg-surface">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.artworkUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-gradient-to-br from-surface-elevated to-accent/10" />
          )}
        </div>
        <PreviewButton trackId={track.spotifyId} previewUrl={track.previewUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{track.title}</p>
          <p className="truncate text-xs text-muted">{track.artist}</p>
        </div>
        <span className="shrink-0 text-[9px] uppercase tracking-wider text-muted/70">
          {track.relationship}
        </span>
      </div>
    </StaggerItem>
  );
}

export function ConnectedTracks({ tracks }: ConnectedTracksProps) {
  if (tracks.length === 0) return null;

  return (
    <PreviewProvider>
      <FadeIn>
        <section aria-label="Connected tracks" className="space-y-3">
          <header>
            <h2 className="font-display text-lg font-medium">Connected tracks</h2>
            <p className="mt-0.5 text-xs text-muted">
              Remixes, covers, and versions on Spotify
            </p>
          </header>
          <StaggerGroup className="space-y-1.5">
            {tracks.map((track) => (
              <ConnectedTrackRow key={track.spotifyUri} track={track} />
            ))}
          </StaggerGroup>
        </section>
      </FadeIn>
    </PreviewProvider>
  );
}
