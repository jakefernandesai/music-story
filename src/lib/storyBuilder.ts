import type { MusicBrainzEnrichment } from "./musicbrainz";
import type { SpotifyNormalizedTrack } from "./spotify";
import { formatArtists, formatDuration } from "./format";
import { generatePlaylistCandidates } from "./playlistCandidates";
import { buildSongMap } from "./song-map";
import {
  buildPeopleFromStory,
  buildReleaseWorld,
  resolveConnectedTracks,
} from "./story-context";
import type {
  DataSourceConfidence,
  MissingData,
  MusicStory,
  StoryEdge,
  StoryEdgeType,
  StoryNode,
  StoryNodeType,
  Track,
} from "./types";

export type StoryGraph = Pick<
  MusicStory,
  "id" | "rootTrack" | "nodes" | "edges" | "confidenceSummary" | "missingData"
>;

export type StoryBuilderInput = {
  spotify: SpotifyNormalizedTrack;
  enrichment: MusicBrainzEnrichment;
};

const EDGE_LABELS: Record<StoryEdgeType, string> = {
  performed_by: "Performed by",
  produced_by: "Produced by",
  written_by: "Written by",
  released_on: "Released on",
  released_by: "Released by",
  similar_to: "Similar to",
  sampled: "Sampled from",
  covered: "Covered by",
  remixed_by: "Remixed as",
  influenced_by: "Influenced by",
  collaborator_of: "Collaborator",
};

const MAX_RELATED_NODES = 10;

type MutableStory = {
  nodes: StoryNode[];
  edges: StoryEdge[];
  nodeIds: Set<string>;
};

function releaseYear(date: string): number {
  const year = Number.parseInt(date.slice(0, 4), 10);
  return Number.isNaN(year) ? 0 : year;
}

function spotifyToRootTrack(
  spotify: SpotifyNormalizedTrack,
  enrichment: MusicBrainzEnrichment,
): Track {
  return {
    id: spotify.id,
    title: spotify.name,
    artists: spotify.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
      spotifyId: artist.id,
    })),
    albumTitle: spotify.album.name,
    artworkUrl: spotify.imageUrl ?? spotify.album.imageUrl ?? "",
    releaseYear: releaseYear(spotify.releaseDate),
    durationMs: spotify.durationMs,
    spotifyUrl: spotify.spotifyUrl,
    spotifyId: spotify.id,
    previewUrl: spotify.previewUrl,
    musicbrainzRecordingId: enrichment.recording?.id,
  };
}

function nodeId(type: StoryNodeType, entityId: string): string {
  return `node-${type}-${entityId}`;
}

function edgeId(sourceNodeId: string, targetNodeId: string, type: StoryEdgeType): string {
  return `edge-${sourceNodeId}-${targetNodeId}-${type}`;
}

function addNode(story: MutableStory, node: StoryNode): string {
  if (story.nodeIds.has(node.id)) return node.id;
  story.nodes.push(node);
  story.nodeIds.add(node.id);
  return node.id;
}

function addEdge(
  story: MutableStory,
  sourceNodeId: string,
  targetNodeId: string,
  type: StoryEdgeType,
  confidence: number,
): void {
  if (
    story.edges.some(
      (edge) =>
        edge.sourceNodeId === sourceNodeId &&
        edge.targetNodeId === targetNodeId &&
        edge.type === type,
    )
  ) {
    return;
  }

  story.edges.push({
    id: edgeId(sourceNodeId, targetNodeId, type),
    sourceNodeId,
    targetNodeId,
    type,
    label: EDGE_LABELS[type],
    confidence,
  });
}

function mapRelatedToNodeType(relationship: string): StoryNodeType {
  const normalised = relationship.toLowerCase();
  if (normalised.includes("remix") || normalised === "edit") return "remix";
  if (normalised.includes("cover")) return "cover";
  if (normalised.includes("sample")) return "sample";
  return "track";
}

function mapRelatedToEdgeType(relationship: string): StoryEdgeType {
  const normalised = relationship.toLowerCase();
  if (normalised.includes("cover")) return "covered";
  if (normalised.includes("sample")) return "sampled";
  if (normalised.includes("remix") || normalised === "edit") return "remixed_by";
  return "similar_to";
}

function buildMissingData(
  enrichment: MusicBrainzEnrichment,
  hasWriters: boolean,
  hasProducers: boolean,
  hasLabels: boolean,
  hasRelated: boolean,
): MissingData[] {
  const missing: MissingData[] = [];

  if (!enrichment.matched) {
    missing.push({
      field: "MusicBrainz recording",
      description:
        enrichment.matchNotes ??
        "No confident MusicBrainz match — enrichment data is unavailable.",
    });
  }

  if (enrichment.matched && !hasWriters) {
    missing.push({
      field: "Songwriter credits",
      description: "No composer or writer relationships found in MusicBrainz.",
    });
  }

  if (enrichment.matched && !hasProducers) {
    missing.push({
      field: "Producer credits",
      description: "No producer relationships found in MusicBrainz.",
    });
  }

  if (enrichment.matched && !hasLabels) {
    missing.push({
      field: "Label information",
      description: "No record labels linked to known releases.",
    });
  }

  if (enrichment.matched && !hasRelated) {
    missing.push({
      field: "Connected tracks",
      description:
        "No related recordings (remixes, edits, covers) found in MusicBrainz.",
    });
  }

  return missing;
}

function buildConfidenceSummary(
  enrichment: MusicBrainzEnrichment,
  nodeCount: number,
  missingCount: number,
): DataSourceConfidence[] {
  const completeness = Math.max(
    0.35,
    Math.min(1, (nodeCount - 1) / 8) - missingCount * 0.05,
  );

  return [
    {
      source: "spotify",
      label: "Spotify metadata",
      confidence: 0.99,
      detail: "Track title, artists, album, artwork, and duration from Spotify.",
    },
    {
      source: "musicbrainz",
      label: "MusicBrainz enrichment",
      confidence: enrichment.matched ? enrichment.confidence : 0,
      detail: enrichment.matched
        ? "Recording matched with credits, releases, and relationships."
        : "No confident MusicBrainz match for this track.",
    },
    {
      source: "inferred",
      label: "Story completeness",
      confidence: Number(completeness.toFixed(2)),
      detail: `${nodeCount} nodes mapped · ${missingCount} gap${missingCount === 1 ? "" : "s"} noted.`,
    },
  ];
}

export async function buildMusicStory(input: StoryBuilderInput): Promise<MusicStory> {
  const { spotify, enrichment } = input;
  const rootTrack = spotifyToRootTrack(spotify, enrichment);
  const artistNames = formatArtists(rootTrack);
  const mbConfidence = enrichment.matched ? enrichment.confidence : 0.5;

  const story: MutableStory = { nodes: [], edges: [], nodeIds: new Set() };

  const rootNodeId = addNode(story, {
    id: nodeId("track", spotify.id),
    type: "track",
    title: spotify.name,
    subtitle: `${artistNames} · ${spotify.album.name}`,
    description: `${formatDuration(spotify.durationMs)} track from ${spotify.album.name} (${releaseYear(spotify.releaseDate) || "unknown year"}).`,
    imageUrl: spotify.imageUrl ?? spotify.album.imageUrl ?? undefined,
    source: "spotify",
    confidence: 1,
    entityId: spotify.id,
  });

  for (const artist of spotify.artists) {
    const artistNodeId = addNode(story, {
      id: nodeId("artist", artist.id),
      type: "artist",
      title: artist.name,
      subtitle: "Performer",
      source: "spotify",
      confidence: 0.99,
      entityId: artist.id,
    });
    addEdge(story, rootNodeId, artistNodeId, "performed_by", 0.99);
  }

  const albumNodeId = addNode(story, {
    id: nodeId("album", spotify.album.id),
    type: "album",
    title: spotify.album.name,
    subtitle: spotify.releaseDate || undefined,
    imageUrl: spotify.imageUrl ?? spotify.album.imageUrl ?? undefined,
    source: "spotify",
    confidence: 0.98,
    entityId: spotify.album.id,
  });
  addEdge(story, rootNodeId, albumNodeId, "released_on", 0.98);

  const writerIds = new Set<string>();
  for (const writer of enrichment.writers) {
    if (writerIds.has(writer.id)) continue;
    writerIds.add(writer.id);

    const writerNodeId = addNode(story, {
      id: nodeId("songwriter", writer.id),
      type: "songwriter",
      title: writer.name,
      subtitle: writer.role,
      source: "musicbrainz",
      confidence: mbConfidence,
      entityId: writer.id,
    });
    addEdge(story, rootNodeId, writerNodeId, "written_by", mbConfidence);
  }

  for (const work of enrichment.works) {
    for (const writer of work.writers) {
      if (writerIds.has(writer.id)) continue;
      writerIds.add(writer.id);

      const writerNodeId = addNode(story, {
        id: nodeId("songwriter", writer.id),
        type: "songwriter",
        title: writer.name,
        subtitle: `${writer.role}${work.iswcs.length > 0 ? ` · ISWC ${work.iswcs[0]}` : ""}`,
        source: "musicbrainz",
        confidence: mbConfidence,
        entityId: writer.id,
      });
      addEdge(story, rootNodeId, writerNodeId, "written_by", mbConfidence);
    }
  }

  const producerIds = new Set<string>();
  for (const producer of enrichment.producers) {
    if (producerIds.has(producer.id)) continue;
    producerIds.add(producer.id);

    const producerNodeId = addNode(story, {
      id: nodeId("producer", producer.id),
      type: "producer",
      title: producer.name,
      subtitle: producer.role,
      source: "musicbrainz",
      confidence: mbConfidence,
      entityId: producer.id,
    });
    addEdge(story, rootNodeId, producerNodeId, "produced_by", mbConfidence);
  }

  const labelIds = new Set<string>();
  for (const label of enrichment.labels) {
    if (labelIds.has(label.id)) continue;
    labelIds.add(label.id);

    const labelNodeId = addNode(story, {
      id: nodeId("label", label.id),
      type: "label",
      title: label.name,
      subtitle: label.catalogNumber
        ? `Catalog ${label.catalogNumber}`
        : undefined,
      source: "musicbrainz",
      confidence: mbConfidence,
      entityId: label.id,
    });
    addEdge(story, rootNodeId, labelNodeId, "released_by", mbConfidence);
  }

  const relatedNodes: StoryNode[] = [];
  for (const related of enrichment.relatedRecordings.slice(0, MAX_RELATED_NODES)) {
    const relatedType = mapRelatedToNodeType(related.relationship);
    const relatedNodeId = addNode(story, {
      id: nodeId(relatedType, related.id),
      type: relatedType,
      title: related.title,
      subtitle: related.relationship,
      source: "musicbrainz",
      confidence: Math.max(0.6, mbConfidence * 0.85),
      entityId: related.id,
    });

    const relatedNode = story.nodes.find((node) => node.id === relatedNodeId);
    if (relatedNode) relatedNodes.push(relatedNode);

    addEdge(
      story,
      rootNodeId,
      relatedNodeId,
      mapRelatedToEdgeType(related.relationship),
      Math.max(0.6, mbConfidence * 0.85),
    );
  }

  const missingData = buildMissingData(
    enrichment,
    writerIds.size > 0,
    producerIds.size > 0,
    labelIds.size > 0,
    relatedNodes.length > 0,
  );

  const confidenceSummary = buildConfidenceSummary(
    enrichment,
    story.nodes.length,
    missingData.length,
  );

  const partialStory: StoryGraph & {
    playlistCandidates: [];
    vibeSignature: null;
    people: import("./types").PeopleByRole;
    releaseWorld: import("./types").ReleaseWorld | null;
    connectedTracks: import("./types").ConnectedSpotifyTrack[];
  } = {
    id: `story-${spotify.id}`,
    rootTrack,
    nodes: story.nodes,
    edges: story.edges,
    confidenceSummary,
    missingData,
    playlistCandidates: [],
    vibeSignature: null,
    people: buildPeopleFromStory({ nodes: story.nodes, rootTrack }, enrichment),
    releaseWorld: buildReleaseWorld(rootTrack, enrichment, story.nodes),
    connectedTracks: await resolveConnectedTracks(enrichment, spotify.id),
  };

  const rootArtistName = rootTrack.artists[0]?.name ?? "";
  const { buildRootVibeSignature } = await import("./vibeSignature");
  const fullVibeSignature = await buildRootVibeSignature(
    rootArtistName,
    rootTrack.title,
  );
  const vibeSignature = fullVibeSignature
    ? {
        labels: fullVibeSignature.labels,
        topDimensions: fullVibeSignature.topDimensions,
        label: fullVibeSignature.label,
        sentence: fullVibeSignature.sentence,
        availableDirections: fullVibeSignature.availableDirections,
      }
    : null;

  const storyWithVibe = { ...partialStory, vibeSignature };
  const { playlists, discovery } = await generatePlaylistCandidates({
    ...storyWithVibe,
    vibeSignature,
  });
  const storyWithPlaylists = {
    ...storyWithVibe,
    playlistCandidates: playlists,
    rabbitHoleDiscovery: discovery,
  };

  return {
    ...storyWithPlaylists,
    songMap: buildSongMap(storyWithPlaylists),
  };
}
