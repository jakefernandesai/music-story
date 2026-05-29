import { formatArtists } from "../format";
import { GENRE_SCENE_SEEDS } from "../playlist-seeds";
import type { MusicStory, PlaylistCandidate, PlaylistCandidateTrack } from "../types";
import {
  placeSongMapNode,
  scoreSongMapCandidate,
  scoreSongMapSignals,
} from "./scoring";
import type {
  SongMap,
  SongMapNode,
  SongMapNodeKind,
  SongMapNodeSource,
} from "./types";

type SongMapStoryInput = Pick<
  MusicStory,
  "rootTrack" | "nodes" | "edges" | "playlistCandidates"
>;

type RawCandidate = {
  id: string;
  title: string;
  artist: string;
  spotifyUri?: string;
  kind: SongMapNodeKind;
  source: SongMapNodeSource;
  reason: string;
  confidence: number;
};

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function candidateKey(title: string, artist: string, uri?: string): string {
  return uri ?? `${normalise(title)}|${normalise(artist)}`;
}

function kindFromPlaylist(playlist: PlaylistCandidate): SongMapNodeKind {
  if (playlist.name.startsWith("More from")) return "same_artist";
  if (playlist.name.startsWith("Through collaborators")) return "collaborator";
  if (playlist.name.startsWith("Connected")) return "connected";
  if (playlist.id.includes("genre") || playlist.description.toLowerCase().includes("fallback")) {
    return "curated_fallback";
  }
  return "genre_scene";
}

function kindFromTrack(
  track: PlaylistCandidateTrack,
  playlistKind: SongMapNodeKind,
): SongMapNodeKind {
  if (track.isSeed) return "root";
  if (track.source === "curated_fallback") return "curated_fallback";
  if (track.source === "lastfm_similar_artist" || track.source === "lastfm_tag_seed") {
    return "genre_scene";
  }
  if (track.source === "musicbrainz_related_recording") return "connected";
  if (playlistKind === "same_artist") return "same_artist";
  if (playlistKind === "collaborator") return "collaborator";
  if (playlistKind === "connected") return "connected";
  return "genre_scene";
}

function genreHintsForStory(story: SongMapStoryInput): string[] {
  const hints = [
    ...story.rootTrack.artists.map((artist) => artist.name),
    story.rootTrack.albumTitle,
    story.rootTrack.title,
    ...story.nodes
      .filter((node) => node.type === "genre" || node.type === "scene")
      .map((node) => node.title),
  ];

  for (const seed of GENRE_SCENE_SEEDS) {
    const corpus = hints.join(" ").toLowerCase();
    if (seed.matchKeywords.some((keyword) => corpus.includes(keyword.toLowerCase()))) {
      hints.push(seed.label, seed.scene ?? "");
    }
  }

  return hints;
}

function collectPlaylistCandidates(story: SongMapStoryInput): RawCandidate[] {
  const results: RawCandidate[] = [];

  for (const playlist of story.playlistCandidates) {
    const playlistKind = kindFromPlaylist(playlist);

    for (const track of playlist.tracks) {
      if (track.isSeed) continue;

      const kind = kindFromTrack(track, playlistKind);
      results.push({
        id: candidateKey(track.title, track.artist, track.spotifyUri),
        title: track.title,
        artist: track.artist,
        spotifyUri: track.spotifyUri,
        kind,
        source: track.source,
        reason: track.reason,
        confidence: track.confidence,
      });
    }
  }

  return results;
}

function collectStoryGraphCandidates(story: SongMapStoryInput): RawCandidate[] {
  const rootNode = story.nodes.find(
    (node) => node.type === "track" && node.entityId === story.rootTrack.id,
  );
  if (!rootNode) return [];

  const connectedIds = new Set(
    story.edges
      .filter((edge) => edge.sourceNodeId === rootNode.id)
      .map((edge) => edge.targetNodeId),
  );

  return story.nodes
    .filter(
      (node) =>
        connectedIds.has(node.id) &&
        ["remix", "cover", "sample", "track"].includes(node.type),
    )
    .map((node) => ({
      id: `story-${node.id}`,
      title: node.title,
      artist: node.subtitle?.split("·")[0]?.trim() ?? "Unknown artist",
      kind: "connected" as const,
      source: "story_graph" as const,
      reason: `Story graph ${node.subtitle ?? node.type} linked to ${story.rootTrack.title}`,
      confidence: node.confidence,
    }));
}

function dedupeCandidates(candidates: RawCandidate[]): RawCandidate[] {
  const seen = new Set<string>();
  const result: RawCandidate[] = [];

  for (const candidate of candidates) {
    const key = candidateKey(candidate.title, candidate.artist, candidate.spotifyUri);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function buildRootCandidate(story: SongMapStoryInput): RawCandidate {
  return {
    id: candidateKey(
      story.rootTrack.title,
      formatArtists(story.rootTrack),
      `spotify:track:${story.rootTrack.spotifyId ?? story.rootTrack.id}`,
    ),
    title: story.rootTrack.title,
    artist: formatArtists(story.rootTrack),
    spotifyUri: `spotify:track:${story.rootTrack.spotifyId ?? story.rootTrack.id}`,
    kind: "root",
    source: "story_graph",
    reason: `Anchor track — your starting point for this map`,
    confidence: 1,
  };
}

export function buildSongMap(story: SongMapStoryInput): SongMap {
  const genreHints = genreHintsForStory(story);
  const grouped = new Map<SongMapNodeKind, RawCandidate[]>();

  const raw = dedupeCandidates([
    buildRootCandidate(story),
    ...collectPlaylistCandidates(story),
    ...collectStoryGraphCandidates(story),
  ]);

  for (const candidate of raw) {
    const bucket = grouped.get(candidate.kind) ?? [];
    bucket.push(candidate);
    grouped.set(candidate.kind, bucket);
  }

  const nodes: SongMapNode[] = [];

  for (const [kind, candidates] of grouped.entries()) {
    candidates
      .sort(
        (a, b) =>
          scoreSongMapCandidate({
            signals: scoreSongMapSignals({
              title: b.title,
              artist: b.artist,
              kind,
              albumTitle: story.rootTrack.albumTitle,
              genreHints,
            }),
            confidence: b.confidence,
            kind,
          }) -
          scoreSongMapCandidate({
            signals: scoreSongMapSignals({
              title: a.title,
              artist: a.artist,
              kind,
              albumTitle: story.rootTrack.albumTitle,
              genreHints,
            }),
            confidence: a.confidence,
            kind,
          }),
      )
      .slice(0, kind === "root" ? 1 : 8)
      .forEach((candidate, index, list) => {
        const signals = scoreSongMapSignals({
          title: candidate.title,
          artist: candidate.artist,
          kind,
          albumTitle: story.rootTrack.albumTitle,
          genreHints,
        });
        const position = placeSongMapNode({
          kind,
          signals,
          index,
          total: list.length,
          id: candidate.id,
        });

        nodes.push({
          ...candidate,
          signals,
          x: position.x,
          y: position.y,
          isRoot: kind === "root",
        });
      });
  }

  return {
    rootTrackId: story.rootTrack.id,
    rootLabel: `${story.rootTrack.title} · ${formatArtists(story.rootTrack)}`,
    nodes,
    axes: {
      x: { min: "Softer", max: "Heavier" },
      y: { min: "Familiar", max: "Stranger" },
    },
  };
}