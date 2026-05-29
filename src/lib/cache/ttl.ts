/** Cache TTL values in milliseconds. */
export const CACHE_TTL_MS = {
  lastfmArtistTags: 7 * 24 * 60 * 60 * 1000,
  lastfmSimilarArtists: 7 * 24 * 60 * 60 * 1000,
  lastfmTopTracks: 7 * 24 * 60 * 60 * 1000,
  lastfmTrackTags: 7 * 24 * 60 * 60 * 1000,
  lastfmTagArtists: 7 * 24 * 60 * 60 * 1000,
  spotifyResolvedTrack: 30 * 24 * 60 * 60 * 1000,
  spotifyArtistSearch: 30 * 24 * 60 * 60 * 1000,
  recommendationPlaylist: 7 * 24 * 60 * 60 * 1000,
} as const;

export type CacheNamespace = keyof typeof CACHE_TTL_MS;
