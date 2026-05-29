import { cacheGet, cacheSet, clearMemoryCache } from "./cache/persistent-store";
import { recordLastfmCall } from "./recommendation-metrics";

export const LASTFM_SOURCE = "lastfm" as const;

export type LastfmTag = {
  name: string;
  count: number;
  weight: number;
  source: typeof LASTFM_SOURCE;
};

export type LastfmSimilarArtist = {
  name: string;
  match: number;
  source: typeof LASTFM_SOURCE;
};

export type LastfmTopTrack = {
  name: string;
  artist: string;
  playcount?: number;
  source: typeof LASTFM_SOURCE;
};

type LastfmApiResponse = {
  error?: number;
  message?: string;
  toptags?: {
    tag?: Array<{ name: string; count: string }>;
  };
  similarartists?: {
    artist?: Array<{ name: string; match: string }>;
  };
  topartists?: {
    artist?: Array<{ name: string; playcount?: string; listeners?: string }>;
  };
  toptracks?: {
    track?: Array<{ name: string; artist: { name: string }; playcount?: string }>;
  };
};

export function getLastfmApiKey(): string | undefined {
  const key = process.env.LASTFM_API_KEY?.trim();
  return key || undefined;
}

export function isLastfmEnabled(): boolean {
  return Boolean(getLastfmApiKey());
}

function normaliseTagName(value: string): string {
  return value.toLowerCase().trim();
}

function weightTags(
  tags: Array<{ name: string; count: number }>,
): LastfmTag[] {
  if (tags.length === 0) return [];

  const maxCount = Math.max(...tags.map((tag) => tag.count), 1);

  return tags.map((tag, index) => ({
    name: normaliseTagName(tag.name),
    count: tag.count,
    weight: Math.max(0.05, (tag.count / maxCount) * (1 - index * 0.04)),
    source: LASTFM_SOURCE,
  }));
}

async function lastfmRequest(params: Record<string, string>): Promise<LastfmApiResponse | null> {
  const apiKey = getLastfmApiKey();
  if (!apiKey) return null;

  const search = new URLSearchParams({
    ...params,
    api_key: apiKey,
    format: "json",
  });

  try {
    const response = await fetch(`https://ws.audioscrobbler.com/2.0/?${search.toString()}`, {
      next: { revalidate: 3600 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as LastfmApiResponse;
    if (data.error) return null;

    return data;
  } catch {
    return null;
  }
}

async function cachedLastfm<T>(
  namespace: "lastfmArtistTags" | "lastfmSimilarArtists" | "lastfmTopTracks" | "lastfmTrackTags" | "lastfmTagArtists",
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cached = await cacheGet<T>(namespace, key);
  if (cached !== null) {
    recordLastfmCall(true);
    return cached;
  }

  recordLastfmCall(false);
  const value = await fetcher();
  await cacheSet(namespace, key, value);
  return value;
}

/** Clears in-memory cache layer — disk cache persists for cross-request reuse. */
export function clearLastfmCache(): void {
  clearMemoryCache();
}

export async function getLastfmArtistTags(artistName: string): Promise<LastfmTag[]> {
  const cacheKey = normaliseTagName(artistName);
  return cachedLastfm("lastfmArtistTags", cacheKey, async () => {
    const data = await lastfmRequest({
      method: "artist.getTopTags",
      artist: artistName,
    });

    const raw = data?.toptags?.tag ?? [];
    return weightTags(
      raw
        .map((tag) => ({
          name: tag.name,
          count: Number.parseInt(tag.count, 10) || 0,
        }))
        .filter((tag) => tag.name && tag.name !== "undefined"),
    );
  });
}

export async function getLastfmSimilarArtists(
  artistName: string,
  limit = 15,
): Promise<LastfmSimilarArtist[]> {
  const cacheKey = `${normaliseTagName(artistName)}:${limit}`;
  return cachedLastfm("lastfmSimilarArtists", cacheKey, async () => {
    const data = await lastfmRequest({
      method: "artist.getSimilar",
      artist: artistName,
      limit: String(Math.min(Math.max(limit, 1), 50)),
    });

    return (data?.similarartists?.artist ?? [])
      .map((artist) => ({
        name: artist.name,
        match: Number.parseFloat(artist.match) || 0,
        source: LASTFM_SOURCE,
      }))
      .filter((artist) => artist.name && artist.match > 0)
      .sort((a, b) => b.match - a.match);
  });
}

export async function getLastfmArtistTopTracks(
  artistName: string,
  limit = 3,
): Promise<LastfmTopTrack[]> {
  const cacheKey = `${normaliseTagName(artistName)}:${limit}`;
  return cachedLastfm("lastfmTopTracks", cacheKey, async () => {
    const data = await lastfmRequest({
      method: "artist.getTopTracks",
      artist: artistName,
      limit: String(Math.min(Math.max(limit, 1), 10)),
    });

    return (data?.toptracks?.track ?? [])
      .map((track) => ({
        name: track.name,
        artist: track.artist?.name ?? artistName,
        playcount: track.playcount ? Number.parseInt(track.playcount, 10) : undefined,
        source: LASTFM_SOURCE,
      }))
      .filter((track) => track.name);
  });
}

export async function getLastfmTrackTags(
  artistName: string,
  trackName: string,
): Promise<LastfmTag[]> {
  const cacheKey = `${normaliseTagName(artistName)}:${normaliseTagName(trackName)}`;
  return cachedLastfm("lastfmTrackTags", cacheKey, async () => {
    const data = await lastfmRequest({
      method: "track.getTopTags",
      artist: artistName,
      track: trackName,
    });

    const raw = data?.toptags?.tag ?? [];
    return weightTags(
      raw
        .map((tag) => ({
          name: tag.name,
          count: Number.parseInt(tag.count, 10) || 0,
        }))
        .filter((tag) => tag.name && tag.name !== "undefined"),
    );
  });
}

export async function getLastfmTagTopArtists(
  tagName: string,
  limit = 10,
): Promise<Array<{ name: string; source: typeof LASTFM_SOURCE }>> {
  const cacheKey = `${normaliseTagName(tagName)}:${limit}`;
  return cachedLastfm("lastfmTagArtists", cacheKey, async () => {
    const data = await lastfmRequest({
      method: "tag.getTopArtists",
      tag: tagName,
      limit: String(Math.min(Math.max(limit, 1), 50)),
    });

    return (data?.topartists?.artist ?? [])
      .map((artist) => ({ name: artist.name, source: LASTFM_SOURCE }))
      .filter((artist) => artist.name);
  });
}
