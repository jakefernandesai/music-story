import { cacheGet, cacheSet } from "./cache/persistent-store";
import { recordSpotifyCall } from "./recommendation-metrics";
import { fetchAccessToken, type SpotifyArtistSearchTrack } from "./spotify";
import {
  canUseSpotifyBudget,
  isSpotifyGloballyRateLimited,
  markSpotifyRateLimited,
  type SpotifyBudget,
  withSpotifyThrottle,
} from "./spotify-throttle";

const API_BASE = "https://api.spotify.com/v1";

type SpotifySearchTrackItem = {
  id: string;
  uri: string;
  name: string;
  preview_url: string | null;
  artists: Array<{ id: string; name: string }>;
  album: { images: Array<{ url: string; width?: number | null }> };
};

type SpotifySearchTracksResponse = {
  tracks?: { items?: SpotifySearchTrackItem[] };
};

type SpotifySearchArtistsResponse = {
  artists?: { items?: Array<{ id: string; name: string }> };
};

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function escapeSpotifyQuery(value: string): string {
  return value.replace(/"/g, '\\"');
}

function pickImageUrl(images: Array<{ url: string; width?: number | null }>): string | null {
  if (images.length === 0) return null;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

function mapTrackItem(track: SpotifySearchTrackItem): SpotifyArtistSearchTrack {
  return {
    id: track.id,
    uri: track.uri,
    name: track.name,
    artistLabel: track.artists.map((artist) => artist.name).join(", "),
    artistIds: track.artists.map((artist) => artist.id),
    previewUrl: track.preview_url ?? null,
    imageUrl: pickImageUrl(track.album?.images ?? []),
  };
}

function trackCacheKey(title: string, artist: string): string {
  return `${normalise(artist)}|${normalise(title)}`;
}

function artistCacheKey(artist: string): string {
  return normalise(artist);
}

async function spotifyFetch(
  budget: SpotifyBudget,
  url: string,
): Promise<Response | null> {
  if (!canUseSpotifyBudget(budget)) return null;

  const token = await fetchAccessToken();
  const response = await withSpotifyThrottle(budget, () =>
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );

  if (!response) return null;

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
    markSpotifyRateLimited(retryAfter);
    return null;
  }

  return response;
}

/** Resolve a Last.fm track title + artist to a playable Spotify track (cached 30d). */
export async function resolveSpotifyTrack(
  budget: SpotifyBudget,
  title: string,
  artist: string,
): Promise<SpotifyArtistSearchTrack | null> {
  const key = trackCacheKey(title, artist);
  const cached = await cacheGet<SpotifyArtistSearchTrack>("spotifyResolvedTrack", key);
  if (cached?.uri && cached.id) {
    recordSpotifyCall(true);
    return cached;
  }

  if (isSpotifyGloballyRateLimited() || !canUseSpotifyBudget(budget)) {
    return null;
  }

  recordSpotifyCall(false);
  const params = new URLSearchParams({
    q: `track:"${escapeSpotifyQuery(title)}" artist:"${escapeSpotifyQuery(artist)}"`,
    type: "track",
    limit: "5",
  });

  const response = await spotifyFetch(
    budget,
    `${API_BASE}/search?${params.toString()}`,
  );
  if (!response?.ok) return null;

  const data = (await response.json()) as SpotifySearchTracksResponse;
  const items = (data.tracks?.items ?? []).map(mapTrackItem);
  const targetArtist = normalise(artist);
  const match =
    items.find((item) =>
      item.artistLabel.split(/, | & /).some((name) => normalise(name) === targetArtist),
    ) ?? items[0];

  if (!match?.uri || !match.id) return null;

  await cacheSet("spotifyResolvedTrack", key, match);
  return match;
}

export type SpotifyArtistMatch = {
  id: string;
  name: string;
};

/** Resolve Spotify artist ID by name (cached 30d). */
export async function resolveSpotifyArtist(
  budget: SpotifyBudget,
  artistName: string,
): Promise<SpotifyArtistMatch | null> {
  const cached = await cacheGet<SpotifyArtistMatch>("spotifyArtistSearch", artistCacheKey(artistName));
  if (cached?.id) {
    recordSpotifyCall(true);
    return cached;
  }

  if (isSpotifyGloballyRateLimited() || !canUseSpotifyBudget(budget)) {
    return null;
  }

  recordSpotifyCall(false);
  const params = new URLSearchParams({
    q: `artist:"${escapeSpotifyQuery(artistName)}"`,
    type: "artist",
    limit: "3",
  });

  const response = await spotifyFetch(
    budget,
    `${API_BASE}/search?${params.toString()}`,
  );
  if (!response?.ok) return null;

  const data = (await response.json()) as SpotifySearchArtistsResponse;
  const items = data.artists?.items ?? [];
  const target = normalise(artistName);
  const match =
    items.find((item) => normalise(item.name) === target) ??
    items.find((item) => {
      const name = normalise(item.name);
      return name.includes(target) || target.includes(name);
    }) ??
    items[0];

  if (!match?.id) return null;

  const result = { id: match.id, name: match.name };
  await cacheSet("spotifyArtistSearch", artistCacheKey(artistName), result);
  return result;
}

export { isSpotifyGloballyRateLimited as isSpotifyRateLimited };
