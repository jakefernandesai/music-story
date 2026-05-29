import { parseSpotifyTrackUrl } from "./spotify-url";

const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API_BASE = "https://api.spotify.com/v1";

export type SpotifyNormalizedArtist = {
  id: string;
  name: string;
};

export type SpotifyNormalizedAlbum = {
  id: string;
  name: string;
  releaseDate: string;
  imageUrl: string | null;
};

export type SpotifyNormalizedTrack = {
  id: string;
  name: string;
  artists: SpotifyNormalizedArtist[];
  album: SpotifyNormalizedAlbum;
  releaseDate: string;
  durationMs: number;
  imageUrl: string | null;
  spotifyUrl: string;
  uri: string;
  previewUrl: string | null;
};

type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
};

type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

type SpotifyArtist = {
  id: string;
  name: string;
};

type SpotifyAlbum = {
  id: string;
  name: string;
  release_date: string;
  images: SpotifyImage[];
};

type SpotifyTrackResponse = {
  id: string;
  name: string;
  uri: string;
  duration_ms: number;
  preview_url: string | null;
  external_urls: { spotify: string };
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
};

type SpotifyApiError = {
  error?: {
    status: number;
    message: string;
  };
};

export class SpotifyServiceError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "CONFIG"
      | "INVALID_URL"
      | "NOT_FOUND"
      | "API_ERROR"
      | "AUTH_ERROR",
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "SpotifyServiceError";
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null;

function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new SpotifyServiceError(
      "Spotify credentials are not configured. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET.",
      "CONFIG",
      500,
    );
  }

  return { clientId, clientSecret };
}

function pickImageUrl(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;

  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );
  return sorted[0]?.url ?? null;
}

function normalizeTrack(raw: SpotifyTrackResponse): SpotifyNormalizedTrack {
  const imageUrl = pickImageUrl(raw.album.images);

  return {
    id: raw.id,
    name: raw.name,
    artists: raw.artists.map((artist) => ({
      id: artist.id,
      name: artist.name,
    })),
    album: {
      id: raw.album.id,
      name: raw.album.name,
      releaseDate: raw.album.release_date,
      imageUrl,
    },
    releaseDate: raw.album.release_date,
    durationMs: raw.duration_ms,
    imageUrl,
    spotifyUrl: raw.external_urls.spotify,
    uri: raw.uri,
    previewUrl: raw.preview_url ?? null,
  };
}

export async function fetchAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.value;
  }

  const { clientId, clientSecret } = getCredentials();
  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64",
  );

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    throw new SpotifyServiceError(
      "Failed to authenticate with Spotify.",
      "AUTH_ERROR",
      502,
    );
  }

  const data = (await response.json()) as SpotifyTokenResponse;

  cachedToken = {
    value: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000 - 60_000,
  };

  return data.access_token;
}

export function extractTrackIdFromInput(input: string): string {
  const trimmed = input.trim();

  const fromUrl = parseSpotifyTrackUrl(trimmed);
  if (fromUrl) return fromUrl;

  const uriMatch = trimmed.match(/^spotify:track:([a-zA-Z0-9]+)$/);
  if (uriMatch?.[1]) return uriMatch[1];

  if (/^[a-zA-Z0-9]{22}$/.test(trimmed)) return trimmed;

  throw new SpotifyServiceError(
    "Invalid Spotify track URL. Expected a link like https://open.spotify.com/track/...",
    "INVALID_URL",
    400,
  );
}

export async function fetchSpotifyTrack(
  input: string,
): Promise<SpotifyNormalizedTrack> {
  const trackId = extractTrackIdFromInput(input);
  const token = await fetchAccessToken();

  const response = await fetch(`${API_BASE}/tracks/${trackId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    next: { revalidate: 0 },
  });

  if (response.status === 404) {
    throw new SpotifyServiceError(
      "Track not found on Spotify.",
      "NOT_FOUND",
      404,
    );
  }

  if (!response.ok) {
    let detail = "Spotify API request failed.";

    try {
      const errorBody = (await response.json()) as SpotifyApiError;
      if (errorBody.error?.message) {
        detail = errorBody.error.message;
      }
    } catch {
      // Keep generic message when error body is not JSON.
    }

    throw new SpotifyServiceError(detail, "API_ERROR", 502);
  }

  const raw = (await response.json()) as SpotifyTrackResponse;
  return normalizeTrack(raw);
}

/** Batch-fetch preview URLs and artwork for track IDs (max 50 per call). */
export async function fetchTrackDetails(
  trackIds: string[],
): Promise<Map<string, { previewUrl: string | null; imageUrl: string | null }>> {
  const result = new Map<string, { previewUrl: string | null; imageUrl: string | null }>();
  if (trackIds.length === 0) return result;

  try {
    const token = await fetchAccessToken();
    const unique = [...new Set(trackIds)].slice(0, 50);
    const params = new URLSearchParams({ ids: unique.join(",") });

    const response = await fetch(`${API_BASE}/tracks?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!response.ok) return result;

    const data = (await response.json()) as { tracks?: SpotifyTrackResponse[] };
    for (const track of data.tracks ?? []) {
      if (!track?.id) continue;
      result.set(track.id, {
        previewUrl: track.preview_url ?? null,
        imageUrl: pickImageUrl(track.album?.images ?? []),
      });
    }
  } catch {
    // Non-fatal — previews are optional.
  }

  return result;
}

/** Clears the in-memory token cache — useful in tests. */
export function clearSpotifyTokenCache(): void {
  cachedToken = null;
}

export type SpotifyArtistSearchTrack = {
  id: string;
  uri: string;
  name: string;
  artistLabel: string;
  artistIds?: string[];
  previewUrl: string | null;
  imageUrl: string | null;
};

type SpotifySearchTrackItem = {
  id: string;
  uri: string;
  name: string;
  preview_url: string | null;
  artists: SpotifyArtist[];
  album: SpotifyAlbum;
};

type SpotifySearchTracksResponse = {
  tracks?: {
    items?: SpotifySearchTrackItem[];
  };
};

function escapeSpotifyQuery(value: string): string {
  return value.replace(/"/g, '\\"');
}

/** Search tracks by artist name using Client Credentials. Returns [] on failure. */
export async function searchTracksByArtist(
  artistName: string,
  limit = 2,
): Promise<SpotifyArtistSearchTrack[]> {
  try {
    const token = await fetchAccessToken();
    const params = new URLSearchParams({
      q: `artist:"${escapeSpotifyQuery(artistName)}"`,
      type: "track",
      limit: String(Math.min(Math.max(limit, 1), 10)),
    });

    const response = await fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!response.ok) return [];

    const data = (await response.json()) as SpotifySearchTracksResponse;

    return (data.tracks?.items ?? []).slice(0, limit).map((track) => ({
      id: track.id,
      uri: track.uri,
      name: track.name,
      artistLabel: track.artists.map((artist) => artist.name).join(", "),
      artistIds: track.artists.map((artist) => artist.id),
      previewUrl: track.preview_url ?? null,
      imageUrl: pickImageUrl(track.album?.images ?? []),
    }));
  } catch {
    return [];
  }
}

export type SpotifyArtistMatch = {
  id: string;
  name: string;
  popularity: number;
  genres: string[];
  confidence: "high" | "medium" | "low";
};

type SpotifySearchArtistsResponse = {
  artists?: {
    items?: Array<{
      id: string;
      name: string;
      popularity: number;
      genres: string[];
    }>;
  };
};

function normaliseArtistName(value: string): string {
  return value.toLowerCase().trim();
}

function scoreArtistNameMatch(query: string, candidate: string): "high" | "medium" | "low" {
  const q = normaliseArtistName(query);
  const c = normaliseArtistName(candidate);
  if (q === c) return "high";
  if (c.includes(q) || q.includes(c)) return "medium";
  return "low";
}

/** Search Spotify artists by name. Returns best match or null. */
export async function searchSpotifyArtist(
  artistName: string,
): Promise<SpotifyArtistMatch | null> {
  try {
    const token = await fetchAccessToken();
    const params = new URLSearchParams({
      q: `artist:"${escapeSpotifyQuery(artistName)}"`,
      type: "artist",
      limit: "5",
    });

    const response = await fetch(`${API_BASE}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!response.ok) return null;

    const data = (await response.json()) as SpotifySearchArtistsResponse;
    const items = data.artists?.items ?? [];
    if (items.length === 0) return null;

    const ranked = items
      .map((artist) => ({
        artist,
        confidence: scoreArtistNameMatch(artistName, artist.name),
      }))
      .sort((a, b) => {
        const confidenceRank = { high: 3, medium: 2, low: 1 };
        return confidenceRank[b.confidence] - confidenceRank[a.confidence];
      });

    const best = ranked[0];
    if (!best || best.confidence === "low") return null;

    return {
      id: best.artist.id,
      name: best.artist.name,
      popularity: best.artist.popularity ?? 0,
      genres: best.artist.genres ?? [],
      confidence: best.confidence,
    };
  } catch {
    return null;
  }
}

export function qualifiesAsPerformingArtist(match: SpotifyArtistMatch): boolean {
  return (
    match.popularity > 25 ||
    (match.genres?.length ?? 0) > 0 ||
    match.confidence === "high"
  );
}

export async function searchTracksForSpotifyArtist(
  match: SpotifyArtistMatch,
  limit = 2,
): Promise<SpotifyArtistSearchTrack[]> {
  const results = await searchTracksByArtist(match.name, Math.max(limit, 3));
  return results
    .filter((track) => track.artistIds?.includes(match.id))
    .slice(0, limit);
}
