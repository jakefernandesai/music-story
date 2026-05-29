/** External data providers used to build a story. */
export type DataSource = "spotify" | "musicbrainz" | "inferred";

export type DataSourceConfidence = {
  source: DataSource;
  label: string;
  /** Normalized score between 0 and 1. */
  confidence: number;
  detail: string;
};

export type Artist = {
  id: string;
  name: string;
  spotifyId?: string;
  musicbrainzId?: string;
  country?: string;
  imageUrl?: string;
};

export type Track = {
  id: string;
  title: string;
  artists: Artist[];
  albumTitle: string;
  artworkUrl: string;
  releaseYear: number;
  durationMs: number;
  spotifyUrl: string;
  spotifyId?: string;
  previewUrl?: string | null;
  musicbrainzRecordingId?: string;
  isrc?: string;
};

export type PathRoute = "familiar" | "adjacent" | "stranger";

export type PersonCredit = {
  name: string;
  role?: string;
};

export type PeopleByRole = {
  producers: PersonCredit[];
  writers: PersonCredit[];
  performers: PersonCredit[];
  remixers: PersonCredit[];
  engineers: PersonCredit[];
};

export type ReleaseWorld = {
  albumTitle: string;
  releaseYear: number;
  releaseDate?: string | null;
  label?: string;
  catalogNumber?: string;
  country?: string;
  format?: string;
};

export type ConnectedSpotifyTrack = {
  title: string;
  artist: string;
  spotifyUri: string;
  spotifyId: string;
  previewUrl: string | null;
  artworkUrl: string | null;
  relationship: string;
};

export type StoryNodeType =
  | "track"
  | "artist"
  | "album"
  | "producer"
  | "songwriter"
  | "label"
  | "genre"
  | "scene"
  | "sample"
  | "cover"
  | "remix"
  | "collaborator";

export type StoryEdgeType =
  | "performed_by"
  | "produced_by"
  | "written_by"
  | "released_on"
  | "released_by"
  | "similar_to"
  | "sampled"
  | "covered"
  | "remixed_by"
  | "influenced_by"
  | "collaborator_of";

export type StoryNode = {
  id: string;
  type: StoryNodeType;
  title: string;
  subtitle?: string;
  description?: string;
  imageUrl?: string;
  source: DataSource;
  confidence: number;
  /** When this node mirrors a Track or Artist entity. */
  entityId?: string;
};

export type StoryEdge = {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  type: StoryEdgeType;
  label: string;
  confidence: number;
};

export type MissingData = {
  field: string;
  description: string;
};

export type PlaylistCandidateSource =
  | "lastfm_similar_artist"
  | "lastfm_tag_seed"
  | "spotify_search"
  | "musicbrainz_related_recording"
  | "musicbrainz_credit"
  | "curated_fallback";

export type TasteProfileSummary = {
  highlights: Array<{ dimension: string; score: number }>;
  label: string;
};

export type VibeProfileSummary = {
  labels: string[];
  topDimensions: Array<{
    dimension: string;
    score: number;
    tier: string;
    label: string;
  }>;
  label: string;
  sentence: string;
};

/** @deprecated Legacy taste-axis chips — prefer VibeDirectionChip. */
export type DirectionChip =
  | "softer"
  | "heavier"
  | "weirder"
  | "more_clubby"
  | "more_emotional"
  | "more_underground";

export type VibeDirectionChip =
  | "more_euphoric"
  | "more_destructive"
  | "more_nostalgic"
  | "more_futuristic"
  | "more_intimate"
  | "more_melancholic";

export type CandidateProfileDebug = {
  taste?: Record<string, number>;
  vibe?: Record<string, number>;
  tasteCloseness?: number;
  vibeCloseness?: number;
};

export type PlaylistCandidateTrack = {
  title: string;
  artist: string;
  reason: string;
  confidence: number;
  source: PlaylistCandidateSource;
  spotifyUri?: string;
  spotifyId?: string;
  previewUrl?: string | null;
  artworkUrl?: string | null;
  isSeed?: boolean;
  /** Short consumer-facing direction e.g. "heavier", "more euphoric". */
  directionLabel?: string;
  pathRoute?: PathRoute;
  tasteProfile?: TasteProfileSummary;
  vibeProfile?: VibeProfileSummary;
  /** @deprecated Legacy taste-axis hints. */
  directionHints?: DirectionChip[];
  /** Per-track vibe direction hints — structured for future filtering. */
  vibeDirectionHints?: VibeDirectionChip[];
  /** Present when PLAYLIST_VIBE_DEBUG or NEXT_PUBLIC_DEBUG_RECS is set. */
  debug?: CandidateProfileDebug;
};

export type PlaylistCandidate = {
  id: string;
  name: string;
  description: string;
  vibe: string;
  trackCount: number;
  seedTrackId: string;
  tracks: PlaylistCandidateTrack[];
  /** Which rabbit-hole path this playlist represents. */
  pathRoute?: PathRoute;
  availableDirections?: VibeDirectionChip[];
  pathCounts?: Record<PathRoute, number>;
  fallbackUsed?: boolean;
  /** Demo-only curated seeds — not real recommendations. */
  demoFallback?: boolean;
};

export type LastfmSimilarArtistPreview = {
  name: string;
  matchScore: number;
  spotifyResolved: boolean;
  note?: string;
};

export type RabbitHoleDiscoveryState = {
  status: "ready" | "rate_limited" | "unavailable" | "warming_up" | "cached";
  message: string;
  spotifyRateLimited: boolean;
  realCandidateCount: number;
  demoFallbackActive: boolean;
  servedFromCache?: boolean;
  partialDueToRateLimit?: boolean;
  /** Dev fixture mode — recommendations from static fixture world. */
  fixtureMode?: boolean;
  /** Non-playable Last.fm context for debug panels. */
  similarArtists?: LastfmSimilarArtistPreview[];
};

export type VibeSignature = VibeProfileSummary & {
  availableDirections: VibeDirectionChip[];
};

export type MusicStory = {
  id: string;
  rootTrack: Track;
  nodes: StoryNode[];
  edges: StoryEdge[];
  confidenceSummary: DataSourceConfidence[];
  missingData: MissingData[];
  people: PeopleByRole;
  releaseWorld: ReleaseWorld | null;
  connectedTracks: ConnectedSpotifyTrack[];
  playlistCandidates: PlaylistCandidate[];
  rabbitHoleDiscovery?: RabbitHoleDiscoveryState;
  songMap: import("./song-map/types").SongMap;
  vibeSignature: VibeSignature | null;
};

export type { SongMap, SongMapNode } from "./song-map/types";
