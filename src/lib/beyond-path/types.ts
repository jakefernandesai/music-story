import type {
  PlaylistCandidateSource,
  TasteProfileSummary,
  VibeDirectionChip,
  VibeProfileSummary,
} from "../types";
import type { TasteProfile } from "../tasteProfile";
import type { VibeProfile } from "../vibeProfile";
import type { MusicFamily } from "../music-family";

export type BeyondConnectionType =
  | "lastfm_similar_artist"
  | "lastfm_tag_seed"
  | "same_artist"
  | "featured_artist"
  | "producer_credit"
  | "songwriter_credit"
  | "musicbrainz_related"
  | "scene_seed"
  | "genre_seed"
  | "fallback";

export type BeyondMatchMethod =
  | "exact_artist"
  | "title_only"
  | "musicbrainz"
  | "seed"
  | "lastfm"
  | "none";

export type BeyondCandidate = {
  key: string;
  title: string;
  artist: string;
  spotifyUri?: string;
  spotifyId?: string;
  previewUrl?: string | null;
  artworkUrl?: string | null;
  connectionType: BeyondConnectionType;
  source: PlaylistCandidateSource;
  reason: string;
  confidence: number;
  musicalAdjacencyScore: number;
  matchMethod: BeyondMatchMethod;
  searchedPerson?: string;
  sceneLabel?: string;
  tasteProfile?: TasteProfileSummary;
  vibeProfile?: VibeProfileSummary;
  vibeDirectionHints?: VibeDirectionChip[];
  /** Full profiles for debug output when enabled. */
  tasteProfileFull?: TasteProfile;
  vibeProfileFull?: VibeProfile;
  tasteCloseness?: number;
  vibeCloseness?: number;
  musicFamily?: MusicFamily;
  sharedTags?: string[];
  lastfmMatch?: number;
  pathRoute?: import("../types").PathRoute;
};

export const BEYOND_LIMITS = {
  minTracks: 3,
  maxTracks: 5,
  maxLastfmCandidates: 8,
  lastfmSimilar: 4,
  lastfmTagSeed: 3,
  sameArtist: 0,
  featuredArtist: 0,
  musicbrainzRelated: 1,
  producerCredit: 1,
  songwriterCredit: 1,
} as const;
