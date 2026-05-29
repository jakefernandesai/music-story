import { fetchAccessToken, type SpotifyArtistSearchTrack } from "./spotify";

const API_BASE = "https://api.spotify.com/v1";
const REQUEST_DELAY_MS = 100;
const MAX_TRACK_QUERIES_PER_ARTIST = 4;

type SpotifySearchTrackItem = {
  id: string;
  uri: string;
  name: string;
  preview_url: string | null;
  artists: Array<{ id: string; name: string }>;
  album: { images: Array<{ url: string; width?: number | null }> };
};

type SpotifySearchArtistItem = {
  id: string;
  name: string;
};

type SpotifySearchTracksResponse = {
  tracks?: { items?: SpotifySearchTrackItem[] };
};

type SpotifySearchArtistsResponse = {
  artists?: { items?: SpotifySearchArtistItem[] };
};

export type SpotifyQueryAttempt = {
  query: string;
  status: number;
  resultCount: number;
  selectedCount: number;
  rejectionReason?: string;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
};

export type SimilarArtistSpotifyDiagnostic = {
  artistName: string;
  lastfmMatchScore?: number;
  queries: SpotifyQueryAttempt[];
  selectedTrackCount: number;
  unresolvedReason?: string;
};

export type UnresolvedSimilarArtist = {
  lastfmArtist: string;
  lastfmMatchScore: number;
  reason: string;
};

const searchCache = new Map<string, SpotifyArtistSearchTrack[]>();
let rateLimitUntil = 0;
let lastRequestAt = 0;

function normalise(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function cleanArtistName(name: string): string {
  return name
    .replace(/\s+/g, " ")
    .replace(/[\\/]+/g, " ")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function primaryArtistPart(name: string): string | null {
  const primary = name.split(/\s*(?:&|,| feat\.?| ft\.?| x | with )\s*/i)[0]?.trim();
  if (!primary || normalise(primary) === normalise(name)) return null;
  return cleanArtistName(primary);
}

export function artistNameSearchVariants(artistName: string): string[] {
  const cleaned = cleanArtistName(artistName);
  const primary = primaryArtistPart(cleaned);
  const variants = new Set<string>();

  for (const value of [cleaned, primary, artistName]) {
    if (value) variants.add(value);
  }

  const noDots = cleaned.replace(/\./g, " ").replace(/\s+/g, " ").trim();
  if (noDots) variants.add(noDots);

  return [...variants];
}

/** Prioritized track queries — at most a few per artist to avoid rate-limit bursts. */
function buildQueryStrategies(artistName: string, resolvedArtistName?: string): string[] {
  const variants = artistNameSearchVariants(artistName);
  const primary = resolvedArtistName ?? variants[0] ?? artistName;
  const secondary = variants.find((variant) => normalise(variant) !== normalise(primary));
  const queries: string[] = [
    `artist:"${escapeSpotifyQuery(primary)}"`,
    escapeSpotifyQuery(primary),
  ];

  if (secondary) {
    queries.push(`artist:"${escapeSpotifyQuery(secondary)}"`);
    queries.push(escapeSpotifyQuery(secondary));
  }

  return [...new Set(queries)].slice(0, MAX_TRACK_QUERIES_PER_ARTIST);
}

function fuzzyArtistMatch(track: SpotifyArtistSearchTrack, targetArtist: string): boolean {
  const target = normalise(targetArtist);
  const artists = track.artistLabel.split(/, | & /).map(normalise);

  return artists.some((artist) => {
    if (artist === target) return true;
    if (artist.includes(target) || target.includes(artist)) return true;
    const targetTokens = target.split(" ").filter(Boolean);
    const artistTokens = artist.split(" ").filter(Boolean);
    if (targetTokens.length === 0) return false;
    const overlap = targetTokens.filter((token) => artistTokens.includes(token)).length;
    return overlap / targetTokens.length >= 0.6;
  });
}

function selectTracksForArtist(
  items: SpotifyArtistSearchTrack[],
  targetArtist: string,
  limit: number,
  spotifyArtistId?: string,
): { selected: SpotifyArtistSearchTrack[]; rejectionReason?: string } {
  if (items.length === 0) {
    return { selected: [], rejectionReason: "no Spotify results" };
  }

  const withUri = items.filter((track) => track.uri && track.id);
  if (withUri.length === 0) {
    return { selected: [], rejectionReason: "results missing Spotify URI" };
  }

  if (spotifyArtistId) {
    const byId = withUri.filter((track) => track.artistIds?.includes(spotifyArtistId));
    if (byId.length > 0) {
      return { selected: byId.slice(0, limit) };
    }
  }

  const strict = withUri.filter((track) => fuzzyArtistMatch(track, targetArtist));
  if (strict.length > 0) {
    return { selected: strict.slice(0, limit) };
  }

  return {
    selected: withUri.slice(0, limit),
    rejectionReason: "no strict artist match — using top search results",
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleRequests(): Promise<void> {
  const elapsed = Date.now() - lastRequestAt;
  if (elapsed < REQUEST_DELAY_MS) {
    await sleep(REQUEST_DELAY_MS - elapsed);
  }
  lastRequestAt = Date.now();
}

type SearchResult = {
  status: number;
  items: SpotifyArtistSearchTrack[];
  rateLimited: boolean;
  retryAfterSeconds?: number;
};

function applyRateLimitResponse(retryAfter: number): SearchResult {
  if (retryAfter <= 5) {
    return { status: 429, items: [], rateLimited: true, retryAfterSeconds: retryAfter };
  }
  rateLimitUntil = Date.now() + retryAfter * 1000;
  return { status: 429, items: [], rateLimited: true, retryAfterSeconds: retryAfter };
}

async function fetchWithRateLimit(
  url: string,
  token: string,
): Promise<Response> {
  await throttleRequests();
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (response.status !== 429) {
    return response;
  }

  const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
  if (retryAfter > 5) {
    return response;
  }

  await sleep(retryAfter * 1000);
  await throttleRequests();
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

async function executeArtistSearch(
  artistName: string,
): Promise<{
  status: number;
  match: SpotifySearchArtistItem | null;
  rateLimited: boolean;
  retryAfterSeconds?: number;
}> {
  if (Date.now() < rateLimitUntil) {
    return { status: 429, match: null, rateLimited: true };
  }

  const token = await fetchAccessToken();
  const params = new URLSearchParams({
    q: `artist:"${escapeSpotifyQuery(artistName)}"`,
    type: "artist",
    limit: "3",
  });

  const response = await fetchWithRateLimit(
    `${API_BASE}/search?${params.toString()}`,
    token,
  );

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
    const limited = applyRateLimitResponse(retryAfter);
    return {
      status: 429,
      match: null,
      rateLimited: limited.rateLimited,
      retryAfterSeconds: limited.retryAfterSeconds,
    };
  }

  if (!response.ok) {
    return { status: response.status, match: null, rateLimited: false };
  }

  const data = (await response.json()) as SpotifySearchArtistsResponse;
  const items = data.artists?.items ?? [];
  const target = normalise(artistName);
  const match =
    items.find((artist) => normalise(artist.name) === target) ??
    items.find((artist) => {
      const name = normalise(artist.name);
      return name.includes(target) || target.includes(name);
    }) ??
    items[0] ??
    null;

  return { status: response.status, match, rateLimited: false };
}

async function executeSearchQuery(
  query: string,
  limit: number,
): Promise<SearchResult> {
  if (Date.now() < rateLimitUntil) {
    return { status: 429, items: [], rateLimited: true };
  }

  const token = await fetchAccessToken();
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(Math.min(Math.max(limit, 1), 10)),
  });

  const response = await fetchWithRateLimit(
    `${API_BASE}/search?${params.toString()}`,
    token,
  );

  if (response.status === 429) {
    const retryAfter = Number.parseInt(response.headers.get("Retry-After") ?? "60", 10);
    return applyRateLimitResponse(retryAfter);
  }

  if (!response.ok) {
    return { status: response.status, items: [], rateLimited: false };
  }

  const data = (await response.json()) as SpotifySearchTracksResponse;
  return {
    status: response.status,
    items: (data.tracks?.items ?? []).map(mapTrackItem),
    rateLimited: false,
  };
}

export function clearSpotifyArtistSearchCache(): void {
  searchCache.clear();
}

export function resetSpotifyArtistSearchState(): void {
  searchCache.clear();
  rateLimitUntil = 0;
  lastRequestAt = 0;
}

export function isSpotifyRateLimited(): boolean {
  return Date.now() < rateLimitUntil;
}

function recordQueryAttempt(
  diagnostic: SimilarArtistSpotifyDiagnostic,
  input: {
    query: string;
    status: number;
    resultCount: number;
    selectedCount: number;
    rejectionReason?: string;
    rateLimited?: boolean;
    retryAfterSeconds?: number;
  },
): void {
  diagnostic.queries.push(input);
}

/** Search Spotify for tracks by similar-artist name with multi-strategy queries, cache, and diagnostics. */
export async function searchTracksForSimilarArtist(input: {
  artistName: string;
  limit?: number;
  lastfmMatchScore?: number;
  collectDiagnostic?: boolean;
}): Promise<{
  tracks: SpotifyArtistSearchTrack[];
  diagnostic: SimilarArtistSpotifyDiagnostic;
}> {
  const limit = input.limit ?? 2;
  const cacheKey = `${normalise(input.artistName)}|${limit}`;
  const cached = searchCache.get(cacheKey);
  if (cached) {
    return {
      tracks: cached,
      diagnostic: {
        artistName: input.artistName,
        lastfmMatchScore: input.lastfmMatchScore,
        queries: [{ query: "(cache)", status: 200, resultCount: cached.length, selectedCount: cached.length }],
        selectedTrackCount: cached.length,
      },
    };
  }

  const diagnostic: SimilarArtistSpotifyDiagnostic = {
    artistName: input.artistName,
    lastfmMatchScore: input.lastfmMatchScore,
    queries: [],
    selectedTrackCount: 0,
  };

  if (isSpotifyRateLimited()) {
    diagnostic.unresolvedReason = "spotify rate limited (global cooldown active)";
    recordQueryAttempt(diagnostic, {
      query: "(skipped — rate limited)",
      status: 429,
      resultCount: 0,
      selectedCount: 0,
      rateLimited: true,
    });
    return { tracks: [], diagnostic };
  }

  const allSelected: SpotifyArtistSearchTrack[] = [];
  let spotifyArtistId: string | undefined;
  let resolvedArtistName: string | undefined;

  const artistSearch = await executeArtistSearch(input.artistName);
  recordQueryAttempt(diagnostic, {
    query: `artist search: "${input.artistName}"`,
    status: artistSearch.status,
    resultCount: artistSearch.match ? 1 : 0,
    selectedCount: artistSearch.match ? 1 : 0,
    rateLimited: artistSearch.rateLimited,
    retryAfterSeconds: artistSearch.retryAfterSeconds,
  });

  if (artistSearch.rateLimited) {
    diagnostic.unresolvedReason = `spotify 429 — retry after ${artistSearch.retryAfterSeconds ?? "?"}s`;
    return { tracks: [], diagnostic };
  }

  if (artistSearch.match) {
    spotifyArtistId = artistSearch.match.id;
    resolvedArtistName = artistSearch.match.name;
  }

  const queries = buildQueryStrategies(input.artistName, resolvedArtistName);

  for (const query of queries) {
    if (allSelected.length >= limit) break;

    const result = await executeSearchQuery(query, Math.max(limit * 2, 5));
    const { selected, rejectionReason } = selectTracksForArtist(
      result.items,
      resolvedArtistName ?? input.artistName,
      limit - allSelected.length,
      spotifyArtistId,
    );

    recordQueryAttempt(diagnostic, {
      query,
      status: result.status,
      resultCount: result.items.length,
      selectedCount: selected.length,
      rejectionReason:
        result.items.length > 0 && selected.length === 0 ? rejectionReason : rejectionReason,
      rateLimited: result.rateLimited,
      retryAfterSeconds: result.retryAfterSeconds,
    });

    if (result.rateLimited) {
      diagnostic.unresolvedReason = `spotify 429 — retry after ${result.retryAfterSeconds ?? "?"}s`;
      break;
    }

    for (const track of selected) {
      if (allSelected.some((existing) => existing.id === track.id)) continue;
      allSelected.push(track);
      if (allSelected.length >= limit) break;
    }

    if (allSelected.length >= limit) break;
  }

  diagnostic.selectedTrackCount = allSelected.length;
  if (allSelected.length === 0 && !diagnostic.unresolvedReason) {
    diagnostic.unresolvedReason = "no Spotify tracks resolved after all query strategies";
  }

  if (allSelected.length > 0) {
    searchCache.set(cacheKey, allSelected);
  }

  return { tracks: allSelected, diagnostic };
}

/** Legacy wrapper — uses enhanced search internally. */
export async function searchTracksByArtistEnhanced(
  artistName: string,
  limit = 2,
): Promise<SpotifyArtistSearchTrack[]> {
  const { tracks } = await searchTracksForSimilarArtist({ artistName, limit });
  return tracks;
}

export function wasSpotifyRateLimitedInDiagnostics(
  diagnostics: SimilarArtistSpotifyDiagnostic[],
): boolean {
  return (
    isSpotifyRateLimited() ||
    diagnostics.some((row) =>
      row.queries.some((query) => query.rateLimited || query.status === 429),
    )
  );
}
