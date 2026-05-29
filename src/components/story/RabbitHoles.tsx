"use client";

import { motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  LastfmSimilarArtistPreview,
  PlaylistCandidate,
  PlaylistCandidateTrack,
  RabbitHoleDiscoveryState,
} from "@/lib/types";
import { SlideUp, StaggerGroup, StaggerItem } from "@/components/motion";
import { PreviewButton, PreviewProvider } from "@/components/preview/PreviewProvider";
import { useSpotifySession } from "../SpotifyConnectButton";

const SOURCE_LABELS: Record<string, string> = {
  lastfm_similar_artist: "Last.fm similar artist",
  lastfm_tag_seed: "Last.fm tag seed",
  spotify_search: "Spotify search",
  curated_fallback: "Curated fallback (demo)",
};

type RabbitHolesProps = {
  playlists: PlaylistCandidate[];
  discovery?: RabbitHoleDiscoveryState;
  showDebug?: boolean;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving"; step: string }
  | { status: "success"; playlistUrl: string; added: number }
  | { status: "error"; message: string };

function hasPlayableSpotifyUri(tracks: PlaylistCandidateTrack[]): boolean {
  return tracks.some((track) => Boolean(track.spotifyUri));
}

function SimilarArtistsDebugPanel({ artists }: { artists: LastfmSimilarArtistPreview[] }) {
  if (artists.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-surface-elevated/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        Last.fm similar artists (debug)
      </p>
      <p className="mt-1 text-[11px] text-muted/80">
        Non-playable preview — Spotify URIs were not resolved for these artists.
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {artists.map((artist) => (
          <li
            key={artist.name}
            className="rounded-lg border border-border/40 px-2 py-1.5 text-[11px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{artist.name}</span>
              <span className="shrink-0 tabular-nums text-muted">
                match {(artist.matchScore * 100).toFixed(0)}%
              </span>
            </div>
            <p className="mt-0.5 text-muted/75">
              {artist.spotifyResolved ? "Spotify resolved" : artist.note ?? "Unresolved"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DegradedDiscoveryPanel({
  discovery,
  showDebug,
}: {
  discovery: RabbitHoleDiscoveryState;
  showDebug: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4">
      <p className="text-sm leading-relaxed text-foreground/90">{discovery.message}</p>
      {discovery.demoFallbackActive && (
        <p className="mt-2 text-xs text-muted">
          Demo fallback mode is active — curated seeds may appear below.
        </p>
      )}
      {showDebug && discovery.similarArtists && discovery.similarArtists.length > 0 && (
        <div className="mt-4">
          <SimilarArtistsDebugPanel artists={discovery.similarArtists} />
        </div>
      )}
    </div>
  );
}

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
  const playable = Boolean(track.spotifyUri);

  return (
    <StaggerItem>
      <div
        className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 border-border/40 bg-surface-elevated/20 ${
          selected ? "" : "opacity-45"
        }`}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="shrink-0 scale-90"
          aria-label={`Select ${track.title}`}
          disabled={!playable}
        />
        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-surface">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="h-full w-full bg-surface-elevated" />
          )}
        </div>
        {playable ? (
          <PreviewButton trackId={trackId} previewUrl={track.previewUrl} />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center text-[9px] text-muted/60">
            —
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{track.title}</p>
          <p className="truncate text-[11px] text-muted">{track.artist}</p>
        </div>
        {track.directionLabel && (
          <span className="hidden text-[9px] text-muted/80 sm:inline">{track.directionLabel}</span>
        )}
        {showDebug && (
          <button
            type="button"
            onClick={() => setWhyOpen((v) => !v)}
            className="text-[9px] text-muted/50"
          >
            ?
          </button>
        )}
      </div>
      {showDebug && whyOpen && (
        <p className="px-2 pb-1 text-[10px] text-muted">
          {track.reason} · {SOURCE_LABELS[track.source] ?? track.source}
          {!playable ? " · no Spotify URI" : ""}
        </p>
      )}
    </StaggerItem>
  );
}

function RabbitHoleCard({
  playlist,
  showDebug,
  returnTo,
}: {
  playlist: PlaylistCandidate;
  showDebug: boolean;
  returnTo: string;
}) {
  const { loggedIn } = useSpotifySession();
  const [selected, setSelected] = useState(() => playlist.tracks.map(() => true));
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const selectedTracks = playlist.tracks.filter((_, i) => selected[i]);
  const selectedCount = selectedTracks.length;
  const selectedWithUri = selectedTracks.filter((track) => Boolean(track.spotifyUri));
  const canSave = hasPlayableSpotifyUri(playlist.tracks);

  async function handleSave() {
    if (selectedWithUri.length === 0) return;
    setSaveState({ status: "saving", step: "Resolving…" });
    try {
      const resolveResponse = await fetch("/api/spotify/search-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selectedWithUri.map((t) => ({
            title: t.title,
            artist: t.artist,
            uri: t.spotifyUri,
          })),
        }),
      });
      const resolveData = (await resolveResponse.json()) as { uris?: string[]; error?: string };
      if (!resolveResponse.ok) throw new Error(resolveData.error ?? "Resolve failed");
      const uris = resolveData.uris ?? [];
      if (uris.length === 0) throw new Error("No tracks matched on Spotify.");

      setSaveState({ status: "saving", step: "Creating playlist…" });
      const createResponse = await fetch("/api/spotify/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Beyond — ${playlist.name}`,
          description: playlist.description,
          public: false,
        }),
      });
      const createData = (await createResponse.json()) as {
        playlist?: { id: string; url: string };
        error?: string;
      };
      if (!createResponse.ok || !createData.playlist) {
        throw new Error(createData.error ?? "Create failed");
      }

      setSaveState({ status: "saving", step: "Adding tracks…" });
      const addResponse = await fetch(
        `/api/spotify/playlists/${createData.playlist.id}/tracks`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ uris }) },
      );
      if (!addResponse.ok) throw new Error("Add tracks failed");

      setSaveState({
        status: "success",
        playlistUrl: createData.playlist.url,
        added: uris.length,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Save failed",
      });
    }
  }

  return (
    <article className="rounded-2xl border border-border/70 bg-surface/60 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-medium">{playlist.name}</h3>
          <p className="mt-0.5 text-xs leading-relaxed text-muted">
            {playlist.description}
          </p>
          {playlist.demoFallback && (
            <p className="mt-1 text-[11px] text-amber-400/90">
              Demo fallback — curated seeds, not live recommendations.
            </p>
          )}
        </div>
        <span className="shrink-0 rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[10px] tabular-nums text-muted">
          {selectedCount}/{playlist.trackCount}
        </span>
      </header>

      <StaggerGroup className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1" delayChildren={0.02}>
        {playlist.tracks.map((track, index) => (
          <TrackRow
            key={`${playlist.id}-${index}`}
            track={track}
            index={index}
            playlistId={playlist.id}
            selected={selected[index] ?? true}
            onToggle={() =>
              setSelected((cur) => cur.map((v, i) => (i === index ? !v : v)))
            }
            showDebug={showDebug}
          />
        ))}
      </StaggerGroup>

      {canSave && (
        <div className="mt-3">
          {saveState.status === "error" && (
            <p className="mb-2 text-xs text-red-400/90">{saveState.message}</p>
          )}
          {saveState.status === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs"
            >
              Saved {saveState.added} tracks.{" "}
              <a href={saveState.playlistUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline">
                Open
              </a>
            </motion.div>
          )}
          {loggedIn === false ? (
            <a
              href={`/api/auth/spotify?returnTo=${encodeURIComponent(returnTo)}`}
              className="flex w-full items-center justify-center rounded-xl border border-accent/30 bg-accent/10 py-2.5 text-sm text-accent"
            >
              Connect Spotify to save
            </a>
          ) : (
            <button
              type="button"
              disabled={
                saveState.status === "saving" ||
                selectedWithUri.length === 0 ||
                loggedIn === null
              }
              onClick={() => void handleSave()}
              className="w-full rounded-xl bg-accent py-2.5 text-sm font-medium text-background disabled:opacity-50"
            >
              {saveState.status === "saving"
                ? saveState.step
                : `Save ${selectedWithUri.length} to Spotify`}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

export function RabbitHoles({
  playlists,
  discovery,
  showDebug = false,
}: RabbitHolesProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  const showDegraded = discovery && discovery.status !== "ready" && playlists.length === 0;
  if (!showDegraded && playlists.length === 0) return null;

  return (
    <PreviewProvider>
      <section aria-label="Recommendations" className="space-y-4">
        <SlideUp>
          <header>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-accent">
              Discovery
            </p>
            <h2 className="mt-1 font-display text-2xl font-medium">You might also like</h2>
            <p className="mt-1 text-xs text-muted">
              Three paths out — familiar, adjacent, and stranger.
            </p>
          </header>
        </SlideUp>

        {showDegraded && discovery && (
          <DegradedDiscoveryPanel discovery={discovery} showDebug={showDebug} />
        )}

        {playlists.length > 0 && (
          <div className="space-y-4">
            {playlists.map((playlist) => (
              <RabbitHoleCard
                key={playlist.id}
                playlist={playlist}
                showDebug={showDebug}
                returnTo={returnTo}
              />
            ))}
          </div>
        )}
      </section>
    </PreviewProvider>
  );
}
