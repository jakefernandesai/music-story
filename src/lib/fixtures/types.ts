import type { LastfmSimilarArtistPreview, PlaylistCandidate, RabbitHoleDiscoveryState } from "../types";

export type FixtureRootTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  spotifyUrl: string;
  artworkUrl?: string | null;
};

export type FixtureRecommendationTrack = {
  title: string;
  artist: string;
  reason: string;
  tags?: string[];
  vibeLabels?: string[];
  spotifyUri?: string | null;
  spotifyId?: string | null;
  previewUrl?: string | null;
  artworkUrl?: string | null;
};

export type RecommendationFixtureWorld = {
  slug: string;
  label: string;
  rootTrack: FixtureRootTrack;
  /** Normalised artist names that map to this world. */
  matchArtists: string[];
  /** Optional Spotify root track IDs. */
  matchSpotifyTrackIds?: string[];
  tracks: FixtureRecommendationTrack[];
  similarArtists?: LastfmSimilarArtistPreview[];
};

export type WarmedFixtureFile = {
  version: 1;
  updatedAt: string;
  worlds: RecommendationFixtureWorld[];
};

export type FixturePlaylistResult = {
  playlists: PlaylistCandidate[];
  discovery: RabbitHoleDiscoveryState;
  fixtureSlug: string;
};
