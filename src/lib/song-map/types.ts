import type { PlaylistCandidateSource } from "../types";

export type SongMapNodeKind =
  | "root"
  | "same_artist"
  | "collaborator"
  | "connected"
  | "genre_scene"
  | "curated_fallback";

export type SongMapDirection =
  | "heavier"
  | "softer"
  | "weirder"
  | "more_clubby"
  | "more_emotional"
  | "more_underground";

export type SongMapNodeSignals = {
  /** 0 = familiar, 1 = stranger */
  familiarity: number;
  /** 0 = soft, 1 = heavy */
  weight: number;
  club: number;
  emotional: number;
  underground: number;
  weird: number;
};

export type SongMapNodeSource = PlaylistCandidateSource | "story_graph";

export type SongMapNode = {
  id: string;
  title: string;
  artist: string;
  spotifyUri?: string;
  kind: SongMapNodeKind;
  source: SongMapNodeSource;
  reason: string;
  confidence: number;
  signals: SongMapNodeSignals;
  /** 0 = softer, 1 = heavier */
  x: number;
  /** 0 = familiar, 1 = stranger */
  y: number;
  isRoot?: boolean;
};

export type SongMap = {
  rootTrackId: string;
  rootLabel: string;
  nodes: SongMapNode[];
  axes: {
    x: { min: string; max: string };
    y: { min: string; max: string };
  };
};

export type SongMapDirectionMeta = {
  id: SongMapDirection;
  label: string;
  description: string;
  offset: { dx: number; dy: number };
};

export const SONG_MAP_DIRECTIONS: SongMapDirectionMeta[] = [
  {
    id: "heavier",
    label: "Heavier",
    description: "Push toward denser, harder picks",
    offset: { dx: 0.12, dy: 0.02 },
  },
  {
    id: "softer",
    label: "Softer",
    description: "Pull toward lighter, calmer picks",
    offset: { dx: -0.12, dy: -0.02 },
  },
  {
    id: "weirder",
    label: "Weirder",
    description: "Favour oddball and left-field connections",
    offset: { dx: 0.03, dy: 0.12 },
  },
  {
    id: "more_clubby",
    label: "More clubby",
    description: "Bias toward dancefloor energy",
    offset: { dx: 0.08, dy: 0.06 },
  },
  {
    id: "more_emotional",
    label: "More emotional",
    description: "Bias toward expressive, slower picks",
    offset: { dx: -0.08, dy: 0.08 },
  },
  {
    id: "more_underground",
    label: "More underground",
    description: "Push toward stranger, niche territory",
    offset: { dx: 0.05, dy: 0.14 },
  },
];
