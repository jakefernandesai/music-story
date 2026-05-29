"use client";

import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type {
  LastfmSimilarArtistPreview,
  PlaylistCandidate,
  PlaylistCandidateTrack,
  RabbitHoleDiscoveryState,
  Track,
} from "@/lib/types";
import { ArtworkImage } from "@/components/ArtworkImage";
import { SlideUp, StaggerGroup, StaggerItem } from "@/components/motion";
import { PreviewButton, PreviewProvider, usePreview } from "@/components/preview/PreviewProvider";
import { formatArtists } from "@/lib/format";
import { useSpotifySession } from "../SpotifyConnectButton";

const PREVIEW_ONLY_MESSAGE =
  "Preview playlist — Spotify save will appear when tracks are connected.";

type YouMightAlsoLikeProps = {
  rootTrack: Track;
  playlist?: PlaylistCandidate;
  discovery?: RabbitHoleDiscoveryState;
  showDebug?: boolean;
  fixtureMode?: boolean;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving"; step: string }
  | { status: "success"; playlistUrl: string; added: number }
  | { status: "error"; message: string };

function SimilarArtistsDebugPanel({ artists }: { artists: LastfmSimilarArtistPreview[] }) {
  if (artists.length === 0) return null;

  return (
    <div className="rounded-xl border border-border/60 bg-surface-elevated/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        Last.fm similar artists (debug)
      </p>
      <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto">
        {artists.slice(0, 20).map((artist) => (
          <li
            key={artist.name}
            className="rounded-lg border border-border/40 px-2 py-1.5 text-[11px]"
          >
            <span className="font-medium">{artist.name}</span>
            <span className="ml-2 text-muted">match {(artist.matchScore * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DegradedPanel({
  discovery,
  showDebug,
}: {
  discovery: RabbitHoleDiscoveryState;
  showDebug: boolean;
}) {
  return (
    <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4">
      <p className="text-sm leading-relaxed text-foreground/90">{discovery.message}</p>
      {showDebug && discovery.similarArtists && discovery.similarArtists.length > 0 && (
        <div className="mt-4">
          <SimilarArtistsDebugPanel artists={discovery.similarArtists} />
        </div>
      )}
    </div>
  );
}

function RootHero({
  rootTrack,
  showDebug,
  previewOnly,
}: {
  rootTrack: Track;
  showDebug: boolean;
  previewOnly: boolean;
}) {
  return (
    <div className="relative -mx-5 overflow-hidden sm:mx-0 sm:rounded-2xl">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-accent/8 via-transparent to-background" />
      <div className="relative flex flex-col items-center gap-3 px-5 pb-2 pt-1 text-center sm:flex-row sm:items-end sm:gap-5 sm:px-6 sm:pb-3 sm:pt-3 sm:text-left">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl shadow-[0_12px_40px_-10px_rgba(0,0,0,0.6)] ring-1 ring-white/10 sm:h-28 sm:w-28"
        >
          <ArtworkImage
            src={rootTrack.artworkUrl}
            alt={`${rootTrack.title} artwork`}
            sizes="112px"
            priority
            className="object-cover"
          />
        </motion.div>
        <div className="min-w-0 flex-1 pb-0.5">
          <h1 className="font-display text-xl font-medium leading-tight sm:text-2xl">
            Because you like{" "}
            <span className="text-foreground">{rootTrack.title}</span>
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">
            Pick the tracks you want — we&apos;ll build a Spotify playlist from nearby artists
            and scenes.
          </p>
          <p className="mt-1 truncate text-xs text-foreground/55">{formatArtists(rootTrack)}</p>
          {previewOnly && (
            <p className="mt-2 text-xs leading-relaxed text-muted/80">{PREVIEW_ONLY_MESSAGE}</p>
          )}
          {showDebug && (
            <span className="mt-2 inline-block rounded-full border border-border/50 bg-surface-elevated/40 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-muted">
              debug
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TrackRow({
  track,
  index,
  playlistId,
  selected,
  onToggle,
  expanded,
  onToggleExpanded,
  showDebug,
}: {
  track: PlaylistCandidateTrack;
  index: number;
  playlistId: string;
  selected: boolean;
  onToggle: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  showDebug: boolean;
}) {
  const trackId = track.spotifyId ?? track.spotifyUri ?? `${playlistId}-${index}`;
  const { playingId } = usePreview();
  const isPlaying = playingId === trackId;
  const hasPreview = Boolean(track.previewUrl);

  return (
    <StaggerItem>
      <motion.div
        layout
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className={`group flex min-h-[3.25rem] w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors active:bg-surface-elevated/40 sm:min-h-[3.25rem] sm:gap-3.5 ${
          selected
            ? "border border-accent/25 bg-surface-elevated/35"
            : "border border-transparent bg-transparent"
        } ${isPlaying ? "ring-1 ring-accent/20 bg-accent/5" : ""}`}
        aria-pressed={selected}
        aria-label={`${selected ? "Deselect" : "Select"} ${track.title}`}
      >
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
            selected
              ? "border-accent bg-accent text-background"
              : "border-border/60 bg-transparent"
          }`}
          aria-hidden
        >
          {selected && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg shadow-sm ring-1 ring-white/5 sm:h-11 sm:w-11">
          {track.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.artworkUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-full w-full bg-surface-elevated" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium leading-snug sm:text-sm">
            {track.title}
          </p>
          <p className="truncate text-xs text-muted">{track.artist}</p>
        </div>

        {hasPreview && (
          <span onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
            <PreviewButton trackId={trackId} previewUrl={track.previewUrl} />
          </span>
        )}

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpanded();
          }}
          className="flex shrink-0 items-center justify-center p-1.5 text-muted/45 transition-colors hover:text-muted"
          aria-expanded={expanded}
          aria-label={expanded ? "Hide reason" : "Show reason"}
        >
          <motion.svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <path d="M6 9l6 6 6-6" />
          </motion.svg>
        </button>
      </motion.div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-3 pb-2.5 pt-0.5 text-[11px] leading-relaxed text-muted sm:px-4">
              {track.reason}
              {track.vibeProfile?.labels && track.vibeProfile.labels.length > 0 && (
                <span className="text-muted/65"> · {track.vibeProfile.labels.join(", ")}</span>
              )}
              {showDebug && (
                <span className="mt-1 block font-mono text-[10px] text-muted/50">
                  uri: {track.spotifyUri ?? "none"} · preview: {track.previewUrl ? "yes" : "no"}
                </span>
              )}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </StaggerItem>
  );
}

function StickySaveBar({
  selectedCount,
  saveCount,
  canSave,
  loggedIn,
  saveState,
  returnTo,
  onSave,
}: {
  selectedCount: number;
  saveCount: number;
  canSave: boolean;
  loggedIn: boolean | null;
  saveState: SaveState;
  returnTo: string;
  onSave: () => void;
}) {
  const saveDisabled =
    saveCount === 0 || saveState.status === "saving" || loggedIn === null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border/40 bg-background/80 px-4 pb-[max(0.875rem,env(safe-area-inset-bottom))] pt-3.5 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex max-w-lg items-center gap-4">
        <div className="min-w-0 flex-1">
          {canSave ? (
            <>
              <p className="text-[15px] font-medium tracking-tight tabular-nums">
                {selectedCount} selected
              </p>
              {saveState.status === "success" ? (
                <a
                  href={saveState.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent underline underline-offset-2"
                >
                  Open in Spotify
                </a>
              ) : saveState.status === "error" ? (
                <p className="text-xs text-red-400/90">{saveState.message}</p>
              ) : saveCount < selectedCount ? (
                <p className="text-xs text-muted">
                  {saveCount} of {selectedCount} ready to save
                </p>
              ) : null}
            </>
          ) : (
            <p className="text-sm leading-snug text-muted/90">{PREVIEW_ONLY_MESSAGE}</p>
          )}
        </div>

        {canSave &&
          (loggedIn === false ? (
            <a
              href={`/api/auth/spotify?returnTo=${encodeURIComponent(returnTo)}`}
              className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium tracking-tight text-background shadow-sm transition-opacity active:opacity-90"
            >
              Connect
            </a>
          ) : (
            <button
              type="button"
              disabled={saveDisabled}
              onClick={onSave}
              className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-sm font-medium tracking-tight text-background shadow-sm transition-opacity disabled:cursor-not-allowed disabled:opacity-40 active:opacity-90"
            >
              {saveState.status === "saving"
                ? saveState.step
                : `Save ${saveCount} track${saveCount === 1 ? "" : "s"} to Spotify`}
            </button>
          ))}
      </div>
    </div>
  );
}

function PlaylistExperience({
  playlist,
  returnTo,
  showDebug,
}: {
  playlist: PlaylistCandidate;
  returnTo: string;
  showDebug: boolean;
}) {
  const { loggedIn } = useSpotifySession();
  const [selected, setSelected] = useState(() => playlist.tracks.map(() => true));
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const selectedCount = selected.filter(Boolean).length;
  const selectedWithUri = playlist.tracks.filter(
    (track, i) => selected[i] && Boolean(track.spotifyUri),
  );
  const allSelected = selected.every(Boolean);

  const canSave = playlist.tracks.some((track) => Boolean(track.spotifyUri));
  const saveCount = selectedWithUri.length;

  function toggleAll() {
    setSelected(playlist.tracks.map(() => !allSelected));
  }

  async function handleSave() {
    if (selectedWithUri.length === 0) return;
    setSaveState({ status: "saving", step: "Saving…" });
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

      setSaveState({ status: "saving", step: "Creating…" });
      const createResponse = await fetch("/api/spotify/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: playlist.name,
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

      setSaveState({ status: "saving", step: "Adding…" });
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
    <>
      <div className="flex items-center justify-between gap-3 px-1 pb-1.5 pt-3">
        <p className="text-xs text-muted">
          {playlist.trackCount} tracks · nearby artists & scenes
        </p>
        <button
          type="button"
          onClick={toggleAll}
          className="shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-border hover:text-foreground active:bg-surface-elevated/50"
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <StaggerGroup className="space-y-1 pb-4" delayChildren={0.015}>
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
            expanded={expanded[index] ?? false}
            onToggleExpanded={() =>
              setExpanded((cur) => ({ ...cur, [index]: !cur[index] }))
            }
            showDebug={showDebug}
          />
        ))}
      </StaggerGroup>

      <StickySaveBar
        selectedCount={selectedCount}
        saveCount={saveCount}
        canSave={canSave}
        loggedIn={loggedIn}
        saveState={saveState}
        returnTo={returnTo}
        onSave={() => void handleSave()}
      />
    </>
  );
}

export function YouMightAlsoLike({
  rootTrack,
  playlist,
  discovery,
  showDebug = false,
}: YouMightAlsoLikeProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const q = searchParams.toString();
    return q ? `${pathname}?${q}` : pathname;
  }, [pathname, searchParams]);

  const canSave = playlist?.tracks.some((track) => Boolean(track.spotifyUri)) ?? false;
  const previewOnly = !canSave;

  const degraded =
    discovery &&
    !playlist &&
    discovery.status !== "ready" &&
    discovery.status !== "cached";

  if (!playlist && !degraded) return null;

  return (
    <PreviewProvider>
      <section aria-label="Recommendations" className="pb-28">
        <SlideUp>
          <RootHero rootTrack={rootTrack} showDebug={showDebug} previewOnly={previewOnly} />
        </SlideUp>

        {degraded && discovery && (
          <div className="mt-3">
            <DegradedPanel discovery={discovery} showDebug={showDebug} />
          </div>
        )}

        {playlist && playlist.tracks.length > 0 && (
          <PlaylistExperience playlist={playlist} returnTo={returnTo} showDebug={showDebug} />
        )}

        {playlist && playlist.tracks.length === 0 && (
          <p className="mt-4 text-sm text-muted">No recommendations yet.</p>
        )}
      </section>
    </PreviewProvider>
  );
}
