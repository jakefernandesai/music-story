"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { applyDirectionBias } from "@/lib/song-map/scoring";
import {
  SONG_MAP_DIRECTIONS,
  type SongMap,
  type SongMapDirection,
  type SongMapNode,
} from "@/lib/song-map";
import { useSpotifySession } from "./SpotifyConnectButton";

const KIND_LABELS = {
  root: "Root track",
  same_artist: "Same artist",
  collaborator: "Collaborator",
  connected: "Connected recording",
  genre_scene: "Genre / scene",
  curated_fallback: "Fallback",
} as const;

const SOURCE_LABELS: Record<string, string> = {
  lastfm_similar_artist: "Last.fm",
  lastfm_tag_seed: "Last.fm tag",
  spotify_search: "Spotify search",
  musicbrainz_related_recording: "MusicBrainz",
  musicbrainz_credit: "MusicBrainz credit",
  curated_fallback: "Fallback seed",
  story_graph: "Story graph",
};

type SongMapExplorerProps = {
  songMap: SongMap;
  seedTrackUri: string;
};

type SaveState =
  | { status: "idle" }
  | { status: "saving"; step: string }
  | { status: "success"; playlistUrl: string; added: number }
  | { status: "error"; message: string };

function positionedNodes(
  nodes: SongMapNode[],
  direction: SongMapDirection | null,
): SongMapNode[] {
  if (!direction) return nodes;

  const offset = SONG_MAP_DIRECTIONS.find((item) => item.id === direction)?.offset;
  if (!offset) return nodes;

  return nodes.map((node) => {
    if (node.isRoot) return node;
    const next = applyDirectionBias(node.x, node.y, node.signals, offset);
    return { ...node, x: next.x, y: next.y };
  });
}

export function SongMapExplorer({ songMap, seedTrackUri }: SongMapExplorerProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const { loggedIn } = useSpotifySession();
  const [direction, setDirection] = useState<SongMapDirection | null>(null);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(songMap.nodes.filter((node) => node.isRoot).map((node) => node.id)),
  );
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });

  const nodes = useMemo(
    () => positionedNodes(songMap.nodes, direction),
    [songMap.nodes, direction],
  );

  const activeNode = nodes.find((node) => node.id === activeNodeId) ?? null;
  const selectedNodes = nodes.filter((node) => selectedIds.has(node.id));

  function toggleSelected(node: SongMapNode) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(node.id)) {
        if (node.isRoot) return current;
        next.delete(node.id);
      } else {
        next.add(node.id);
      }
      return next;
    });
  }

  async function handleSaveSelection() {
    if (selectedNodes.length === 0) {
      setSaveState({ status: "error", message: "Select at least one node." });
      return;
    }

    setSaveState({ status: "saving", step: "Resolving tracks…" });

    try {
      const resolveResponse = await fetch("/api/spotify/search-tracks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tracks: selectedNodes.map((node) => ({
            title: node.title,
            artist: node.artist,
            uri: node.spotifyUri ?? (node.isRoot ? seedTrackUri : undefined),
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
        throw new Error("No selected nodes could be matched on Spotify.");
      }

      setSaveState({ status: "saving", step: "Creating playlist…" });

      const createResponse = await fetch("/api/spotify/playlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: `Song Map — ${songMap.rootLabel.split("·")[0]?.trim() ?? "Discovery"}`,
          description: "Experimental Song Map selection from Music Story.",
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

      const addData = (await addResponse.json()) as { error?: string };
      if (!addResponse.ok) {
        throw new Error(addData.error ?? "Failed to add tracks.");
      }

      setSaveState({
        status: "success",
        playlistUrl: createData.playlist.url,
        added: uris.length,
      });
    } catch (error) {
      setSaveState({
        status: "error",
        message: error instanceof Error ? error.message : "Could not save playlist.",
      });
    }
  }

  return (
    <section className="relative pt-4">
      <div
        className="pointer-events-none absolute -top-8 left-1/2 h-px w-24 -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent"
        aria-hidden
      />

      <header className="mb-6 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
          Experimental
        </p>
        <h2 className="mt-2 font-display text-2xl font-medium">Song Map</h2>
        <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted">
          Navigate softer ↔ heavier and familiar ↔ stranger. No Spotify
          recommendations — only search, story graph, and curated fallbacks.
        </p>
      </header>

      <div className="mb-4 flex flex-wrap justify-center gap-2">
        {SONG_MAP_DIRECTIONS.map((item) => {
          const active = direction === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setDirection(active ? null : item.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
              title={item.description}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-3xl border border-border bg-surface">
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full text-border"
          aria-hidden
        >
          <line x1="50%" y1="8%" x2="50%" y2="92%" stroke="currentColor" strokeWidth="1" />
          <line x1="8%" y1="50%" x2="92%" y2="50%" stroke="currentColor" strokeWidth="1" />
        </svg>

        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 -rotate-90 text-[10px] uppercase tracking-wider text-muted">
          {songMap.axes.x.min}
        </span>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rotate-90 text-[10px] uppercase tracking-wider text-muted">
          {songMap.axes.x.max}
        </span>
        <span className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted">
          {songMap.axes.y.min}
        </span>
        <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider text-muted">
          {songMap.axes.y.max}
        </span>

        {nodes.map((node) => {
          const isActive = node.id === activeNodeId;
          const isSelected = selectedIds.has(node.id);
          const size = node.isRoot ? "h-16 w-16" : isActive ? "h-12 w-12" : "h-9 w-9";

          return (
            <button
              key={node.id}
              type="button"
              aria-label={`${node.title} by ${node.artist}`}
              aria-pressed={isActive}
              onClick={() => {
                setActiveNodeId(node.id);
                toggleSelected(node);
              }}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border transition-all ${size} ${
                node.isRoot
                  ? "z-20 border-accent bg-accent/20 shadow-[0_0_24px_rgba(201,169,98,0.25)]"
                  : isSelected
                    ? "z-10 border-accent/50 bg-accent/10"
                    : "border-border/80 bg-surface-elevated/90 hover:border-accent/30"
              } ${isActive ? "ring-2 ring-accent/40" : ""}`}
              style={{
                left: `${node.x * 100}%`,
                top: `${node.y * 100}%`,
              }}
            >
              <span
                className={`block truncate px-1 text-center font-medium leading-none ${
                  node.isRoot ? "text-[9px] text-foreground" : "text-[8px] text-foreground/85"
                }`}
              >
                {node.isRoot ? "★" : node.title.slice(0, 2).toUpperCase()}
              </span>
            </button>
          );
        })}
      </div>

      {activeNode && (
        <div className="mt-5 rounded-2xl border border-border bg-surface p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
                {KIND_LABELS[activeNode.kind]}
              </p>
              <h3 className="mt-1 font-display text-lg font-medium">{activeNode.title}</h3>
              <p className="text-sm text-muted">{activeNode.artist}</p>
            </div>
            <span className="rounded-full border border-border px-2 py-1 text-[10px] text-muted">
              {Math.round(activeNode.confidence * 100)}%
            </span>
          </div>
          <p className="mt-3 text-sm leading-relaxed text-muted">{activeNode.reason}</p>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted/70">
            {SOURCE_LABELS[activeNode.source]}
          </p>
          <p className="mt-3 text-xs text-muted">
            Softer ↔ heavier: {Math.round(activeNode.signals.weight * 100)} · Familiar ↔
            stranger: {Math.round(activeNode.signals.familiarity * 100)}
          </p>
        </div>
      )}

      <div className="mt-5 space-y-3">
        <p className="text-center text-xs text-muted">
          {selectedNodes.length} node{selectedNodes.length === 1 ? "" : "s"} selected
        </p>

        {loggedIn === false && (
          <a
            href={`/api/auth/spotify?returnTo=${encodeURIComponent(returnTo)}`}
            className="flex w-full items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm font-medium text-accent"
          >
            Connect Spotify to save map selection
          </a>
        )}

        {loggedIn && (
          <>
            {saveState.status === "error" && (
              <p className="text-sm text-red-400/90" role="alert">
                {saveState.message}
              </p>
            )}
            {saveState.status === "success" && (
              <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-sm">
                <p className="font-medium">
                  Playlist created — {saveState.added} track
                  {saveState.added === 1 ? "" : "s"} added.
                </p>
                <a
                  href={saveState.playlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-accent underline-offset-2 hover:underline"
                >
                  Open in Spotify
                </a>
              </div>
            )}
            <button
              type="button"
              onClick={() => void handleSaveSelection()}
              disabled={saveState.status === "saving" || selectedNodes.length === 0}
              className="w-full rounded-2xl border border-accent/30 bg-accent px-4 py-3 text-sm font-medium text-background disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saveState.status === "saving"
                ? saveState.step
                : `Add selected to playlist (${selectedNodes.length})`}
            </button>
          </>
        )}
      </div>
    </section>
  );
}
