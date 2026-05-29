const API_BASE = "https://api.spotify.com/v1";

type SpotifyUserProfile = {
  id: string;
  display_name: string | null;
  email?: string;
  images?: Array<{ url: string }>;
};

type SpotifySearchResponse = {
  tracks?: {
    items?: Array<{
      uri: string;
      name: string;
      artists: Array<{ name: string }>;
    }>;
  };
};

type CreatePlaylistResponse = {
  id: string;
  name: string;
  external_urls: { spotify: string };
};

export class SpotifyUserApiError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "SpotifyUserApiError";
  }
}

function formatSpotifyError(status: number, detail: string): string {
  return `Spotify API ${status}: ${detail}`;
}

async function readSpotifyErrorDetail(response: Response): Promise<string> {
  const raw = await response.text();

  if (!raw) {
    return "Request failed with no response body.";
  }

  try {
    const errorBody = JSON.parse(raw) as {
      error?: { message?: string; status?: number };
      error_description?: string;
    };

    if (errorBody.error?.message) return errorBody.error.message;
    if (errorBody.error_description) return errorBody.error_description;
  } catch {
    // Fall through to raw text below.
  }

  return raw;
}

async function spotifyUserFetch<T>(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };

  if (init?.body) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...headers,
      ...(init?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const detail = await readSpotifyErrorDetail(response);
    throw new SpotifyUserApiError(formatSpotifyError(response.status, detail), response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchSpotifyUserProfile(
  accessToken: string,
): Promise<SpotifyUserProfile> {
  return spotifyUserFetch<SpotifyUserProfile>(accessToken, "/me");
}

export async function createSpotifyPlaylist(
  accessToken: string,
  input: {
    name: string;
    description?: string;
    public?: boolean;
  },
): Promise<CreatePlaylistResponse> {
  const user = await fetchSpotifyUserProfile(accessToken);

  return spotifyUserFetch<CreatePlaylistResponse>(
    accessToken,
    `/users/${user.id}/playlists`,
    {
      method: "POST",
      body: JSON.stringify({
        name: input.name,
        description: input.description ?? "",
        public: input.public ?? false,
      }),
    },
  );
}

export async function addTracksToSpotifyPlaylist(
  accessToken: string,
  playlistId: string,
  uris: string[],
): Promise<void> {
  if (uris.length === 0) return;

  const batchSize = 100;
  for (let index = 0; index < uris.length; index += batchSize) {
    const batch = uris.slice(index, index + batchSize);
    await spotifyUserFetch(accessToken, `/playlists/${playlistId}/items`, {
      method: "POST",
      body: JSON.stringify({ uris: batch }),
    });
  }
}

function escapeSearchTerm(value: string): string {
  return value.replace(/"/g, '\\"');
}

export async function searchSpotifyTrackUri(
  accessToken: string,
  input: { title: string; artist: string },
): Promise<string | null> {
  const query = [
    `track:"${escapeSearchTerm(input.title)}"`,
    `artist:"${escapeSearchTerm(input.artist.split(",")[0]?.split(" ft.")[0]?.trim() ?? input.artist)}"`,
  ].join(" ");

  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: "1",
  });

  const result = await spotifyUserFetch<SpotifySearchResponse>(
    accessToken,
    `/search?${params.toString()}`,
  );

  return result.tracks?.items?.[0]?.uri ?? null;
}

export type ResolvedStoryTrack = {
  title: string;
  artist: string;
  uri: string | null;
  matched: boolean;
};

export async function resolveStoryTracksToUris(
  accessToken: string,
  tracks: Array<{ title: string; artist: string; uri?: string }>,
): Promise<ResolvedStoryTrack[]> {
  const resolved: ResolvedStoryTrack[] = [];

  for (const track of tracks) {
    if (track.uri) {
      resolved.push({
        title: track.title,
        artist: track.artist,
        uri: track.uri,
        matched: true,
      });
      continue;
    }

    const uri = await searchSpotifyTrackUri(accessToken, track);
    resolved.push({
      title: track.title,
      artist: track.artist,
      uri,
      matched: Boolean(uri),
    });
  }

  return resolved;
}
