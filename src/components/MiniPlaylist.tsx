"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { MusicStory, PlaylistCandidate, PlaylistCandidateTrack } from "@/lib/types";
import { SlideUp, StaggerGroup, StaggerItem } from "@/components/motion";
import { PathDirection } from "@/components/PathDirection";
import { PathVisual } from "@/components/PathVisual";
import { PreviewButton, PreviewProvider } from "@/components/preview/PreviewProvider";
import { useSpotifySession } from "./SpotifyConnectButton";

const SOURCE_LABELS: Record<string, string> = {
  lastfm_similar_artist: "Last.fm similar artist",
  lastfm_tag_seed: "Last.fm tag seed",
  spotify_search: "Spotify search",
  musicbrainz_related_recording: "MusicBrainz related",
  musicbrainz_credit: "MusicBrainz credit",
  curated_fallback: "Curated fallback",
};

type MiniPlaylistProps = {
  playlist: PlaylistCandidate | null;
  rootTrack: MusicStory["rootTrack"];
  seedTrackUri: string;
  showDebug?: boolean;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving"; step: string }
  | { status: "success"; playlistUrl: string; added: number; skipped: number }
  | { status: "error"; message: string };

function TrackRow({
  track,
  index,
  playlistId,
  selected,
  onToggle,
  showDebug,
}: {
  track: PlaylistCandidateTrack;
  index: number;
  playlistId: string;
  selected: boolean;
  onToggle: () => void;
  showDebug: boolean;
}) {
  const trackId = track.spotifyId ?? track.spotifyUri ?? `${playlistId}-${index}`;
  const [whyOpen, setWhyOpen] = useState(false);

  return (
    <StaggerItem>
      <div
        className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 transition-colors border-border/50 bg-surface-elevated/30 ${
          selected ? "" : "opacity-50"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="shrink-0"
          aria-label={`Select ${track.title}`}
        />

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

        <PreviewButton trackId={trackId} previewUrl={track.previewUrl} />

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium leading-tight">{track.title}</p>
          <p className="truncate text-xs text-muted">{track.artist}</p>
        </div>

        {track.directionLabel && (
          <span className="hidden shrink-0 rounded-full border border-border/60 bg-surface/60 px-2 py-0.5 text-[10px] text-muted sm:inline">
            {track.directionLabel}
          </span>
        )}

        <button
          type="button"
          onClick={() => setWhyOpen((open) => !open)}
          className="shrink-0 text-[10px] text-muted/50 underline-offset-2 hover:text-muted hover:underline"
        >
          Why?
        </button>
      </div>

      <AnimatePresence>
        {whyOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden px-2 pb-1"
          >
            <p className="text-[11px] leading-relaxed text-muted">{track.reason}</p>
            {showDebug && (
              <p className="mt-0.5 text-[10px] text-muted/60">
                {SOURCE_LABELS[track.source] ?? track.source}
                {track.pathRoute ? ` · ${track.pathRoute}` : ""}
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </StaggerItem>
  );
}

function SaveBar({
  playlist,
  selectedTracks,
  returnTo,
}: {
  playlist: PlaylistCandidate;
  selectedTracks: PlaylistCandidateTrack[];
  returnTo: string;
}) {
  const { loggedIn } = useSpotifySession();
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  async function handleSave() {
    if (selectedTracks.length === 0) {
      setSaveState({ status: "error", message: "Select at least one track." });
      return;
    }

    setSaveState({ status: "saving", step: "Finding tracks on Spotify…" });

    try {
      const resolveResponse = await fetch("/api/spotify/search-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selectedTracks.map((track) => ({
            title: track.title,
            artist: track.artist,
            uri: track.spotifyUri,
          })),
        }),
      });

      const resolveData = (await resolveResponse.json()) as {
        uris?: string[];
        error?: string;
      };

      if (!resolveResponse.ok) {
        throw new Error(resolveData.error ?? "Failed to resolve tracks.");
      }

      const uris = resolveData.uris ?? [];
      if (uris.length === 0) {
        throw new Error("No selected tracks could be matched on Spotify.");
      }

      setSaveState({ status: "saving", step: "Creating playlist…" });

      const createResponse = await fetch("/api/spotify/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playlist.name,
          description: `${playlist.description} (Music Story)`,
          public: false,
        }),
      });

      const createData = (await createResponse.json()) as {
        playlist?: { id: string; url: string };
        error?: string;
      };

      if (!createResponse.ok || !createData.playlist) {
        throw new Error(createData.error ?? "Failed to create playlist.");
      }

      setSaveState({ status: "saving", step: "Adding tracks…" });

      const addResponse = await fetch(
        `/api/spotify/playlists/${createData.playlist.id}/tracks`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ uris }),
        },
      );

      if (!addResponse.ok) {
        const addData = (await addResponse.json()) as { error?: string };
        throw new Error(addData.error ?? "Failed to add tracks.");
      }

      setSaveState({
        status: "success",
        playlistUrl: createData.playlist.url,
        added: uris.length,
        skipped: selectedTracks.length - uris.length,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message:
          error instanceof Error ? error.message : "Could not save playlist.",
      });
    }
  }

  if (loggedIn === null) {
    return (
      <button
        type="button"
        disabled
        className="mt-4 w-full rounded-xl border border-border bg-surface-elevated px-4 py-3 text-sm text-muted"
      >
        Checking Spotify…
      </button>
    );
  }

  if (!loggedIn) {
    return (
      <a
        href={`/api/auth/spotify?returnTo=${encodeURIComponent(returnTo)}`}
        className="mt-4 flex w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent"
      >
        Connect Spotify to save playlist
      </a>
    );
  }

  return (
    <div className="mt-4 space-y-2">
      {saveState.status === "error" && (
        <p className="text-sm text-red-400/90">{saveState.message}</p>
      )}
      {saveState.status === "success" && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2.5 text-sm"
        >
          <p>
            Saved {saveState.added} track{saveState.added === 1 ? "" : "s"} to
            Spotify.
          </p>
          <a
            href={saveState.playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-accent underline-offset-2 hover:underline"
          >
            Open playlist
          </a>
        </motion.div>
      )}
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={saveState.status === "saving" || selectedTracks.length === 0}
        className="w-full rounded-xl border border-accent/30 bg-accent px-4 py-3 text-sm font-medium text-background disabled:opacity-50"
      >
        {saveState.status === "saving"
          ? saveState.step
          : `Save ${selectedTracks.length} to Spotify`}
      </button>
    </div>
  );
}

export function MiniPlaylist({
  playlist,
  rootTrack,
  showDebug = false,
}: MiniPlaylistProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [selected, setSelected] = useState<boolean[]>(
    () => playlist?.tracks.map(() => true) ?? [],
  );

  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  if (!playlist || playlist.tracks.length === 0) return null;

  const selectedTracks = playlist.tracks.filter((_, i) => selected[i]);

  return (
    <PreviewProvider>
      <section className="space-y-4">
        <SlideUp>
          <header>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-accent">
              Where to next
            </p>
            <h2 className="mt-1 font-display text-xl font-medium">
              {playlist.name}
            </h2>
            <p className="mt-1 text-xs text-muted">
              {playlist.trackCount} songs · tap to preview
            </p>
          </header>
        </SlideUp>

        <PathDirection availableDirections={playlist.availableDirections} />

        <PathVisual rootTrack={rootTrack} pathCounts={playlist.pathCounts} />

        <StaggerGroup className="space-y-1.5" delayChildren={0.04}>
          {playlist.tracks.map((track, index) => (
            <TrackRow
              key={`${playlist.id}-${index}`}
              track={track}
              index={index}
              playlistId={playlist.id}
              selected={selected[index] ?? true}
              onToggle={() =>
                setSelected((current) =>
                  current.map((value, i) => (i === index ? !value : value)),
                )
              }
              showDebug={showDebug}
            />
          ))}
        </StaggerGroup>

        <SaveBar
          playlist={playlist}
          selectedTracks={selectedTracks}
          returnTo={returnTo}
        />
      </section>
    </PreviewProvider>
  );
}
