import { cacheGet, cacheSet } from "./cache/persistent-store";
import type { PlaylistCandidate, RabbitHoleDiscoveryState } from "./types";

export type CachedPlaylistPayload = {
  playlists: PlaylistCandidate[];
  discovery: RabbitHoleDiscoveryState;
  cachedAt: number;
};

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

export function recommendationCacheKey(input: {
  rootTrackId: string;
  rootArtistName: string;
  rootTrackTitle: string;
}): string {
  return `${input.rootTrackId}:${normalise(input.rootArtistName)}:${normalise(input.rootTrackTitle)}`;
}

export async function getCachedRecommendation(
  key: string,
): Promise<CachedPlaylistPayload | null> {
  return cacheGet<CachedPlaylistPayload>("recommendationPlaylist", key);
}

export async function setCachedRecommendation(
  key: string,
  payload: CachedPlaylistPayload,
): Promise<void> {
  await cacheSet("recommendationPlaylist", key, payload);
}

export async function hasCachedRecommendation(key: string): Promise<boolean> {
  const cached = await getCachedRecommendation(key);
  return cached !== null && cached.playlists.some((p) => p.tracks.length > 0);
}
