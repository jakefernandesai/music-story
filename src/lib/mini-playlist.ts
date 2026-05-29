import { formatArtists } from "./format";
import { collectLastfmCandidates } from "./beyond-path/lastfm-candidates";
import { attachCandidateDebug } from "./playlist-vibe-debug";
import { pickDirectionLabel } from "./direction-labels";
import {
  assessFamilyCompatibility,
  assignPathRoute,
  getAllowedFamilies,
  isMetalOrRockArtist,
  isPopOrMainstreamArtist,
  logCandidateDebug,
  type CandidateDebugRow,
  type MusicFamily,
} from "./music-family";
import {
  DEFAULT_GENRE_SEED_ID,
  GENRE_SCENE_SEEDS,
  type GenreSceneSeedEntry,
  type SeedTrack,
} from "./playlist-seeds";
import { searchTracksByArtistEnhanced, wasSpotifyRateLimitedInDiagnostics, type SimilarArtistSpotifyDiagnostic, type UnresolvedSimilarArtist } from "./spotify-artist-search";
import { isSpotifyRateLimited } from "./spotify-resolver";
import { fetchTrackDetails } from "./spotify";
import {
  beginRecommendationMetrics,
  endRecommendationMetrics,
  logRecommendationMetrics,
} from "./recommendation-metrics";
import {
  getCachedRecommendation,
  recommendationCacheKey,
  setCachedRecommendation,
} from "./recommendation-cache";
import { createSpotifyBudget } from "./spotify-throttle";
import {
  generateFixturePlaylist,
  isRecommendationFixturesEnabled,
} from "./fixtures/recommendation-fixtures";
import type {
  LastfmSimilarArtistPreview,
  MusicStory,
  PathRoute,
  PlaylistCandidate,
  PlaylistCandidateTrack,
  RabbitHoleDiscoveryState,
  VibeDirectionChip,
} from "./types";

type StoryCandidateInput = Pick<
  MusicStory,
  "rootTrack" | "nodes" | "edges" | "vibeSignature"
> & {
  connectedTracks?: MusicStory["connectedTracks"];
};

export type PoolTrack = PlaylistCandidateTrack & {
  musicFamily?: MusicFamily;
  rootMusicFamily?: MusicFamily;
  sharedTags?: string[];
  lastfmMatch?: number;
  tasteCloseness?: number;
};

type SeedWithEntry = { track: SeedTrack; seedEntry: GenreSceneSeedEntry };

/** Single mini-playlist sizing. */
export const PLAYLIST_TARGET = 20;
export const PLAYLIST_MIN = 10;
export const MAX_ROOT_ARTIST_TRACKS = 2;
export const MAX_OTHER_ARTIST_DEFAULT = 1;
export const MAX_OTHER_ARTIST_THIN_POOL = 2;
const THIN_POOL_THRESHOLD = 28;

/** @deprecated Legacy hole constants — kept for diagnosis scripts. */
export const TARGET_MIN = 5;
export const TARGET_MAX = 10;
export const HOLE_MIN_BEFORE_FALLBACK = 4;
export const MAX_FALLBACK_PER_HOLE = 3;

const OBVIOUS_HIT_TITLES =
  /\b(blinding lights|levitating|bad guy|shape of you|uptown funk|happy|rolling in the deep|someone like you|thinking out loud|watermelon sugar|as it was|flowers|vampire)\b/i;

export const FAMILY_DEFAULT_SEED_ID: Record<MusicFamily, string> = {
  electronic: DEFAULT_GENRE_SEED_ID,
  pop: "pop-mainstream",
  metal: "metal-heavy",
  rock: "rock-alternative",
  ambient: DEFAULT_GENRE_SEED_ID,
  hiphop: "pop-mainstream",
  folk: DEFAULT_GENRE_SEED_ID,
  jazz: DEFAULT_GENRE_SEED_ID,
  classical: DEFAULT_GENRE_SEED_ID,
  unknown: DEFAULT_GENRE_SEED_ID,
};

export const RABBIT_HOLES: Array<{
  route: PathRoute;
  name: string;
  description: (artist: string) => string;
}> = [
  {
    route: "familiar",
    name: "Familiar",
    description: (artist) =>
      `Close to ${artist} — same scene, neighbours, and deep cuts.`,
  },
  {
    route: "adjacent",
    name: "Adjacent",
    description: (artist) =>
      `Similar vibe to ${artist}, but a wider circle of artists.`,
  },
  {
    route: "stranger",
    name: "Stranger",
    description: () =>
      "Further out — exploratory picks that still share a taste thread.",
  },
];

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function primaryArtistName(artistLabel: string): string {
  return artistLabel.split(/, | & /)[0]?.trim() ?? artistLabel;
}

export function dedupeKey(track: PlaylistCandidateTrack): string {
  return track.spotifyUri ?? `${normalise(track.title)}|${normalise(track.artist)}`;
}

function toPlaylistTrack(
  candidate: {
    title: string;
    artist: string;
    reason: string;
    confidence: number;
    source: PlaylistCandidateTrack["source"];
    spotifyUri?: string;
    spotifyId?: string;
    previewUrl?: string | null;
    artworkUrl?: string | null;
    vibeDirectionHints?: VibeDirectionChip[];
    tasteCloseness?: number;
    tasteProfileFull?: import("./tasteProfile").TasteProfile;
    vibeProfileFull?: import("./vibeProfile").VibeProfile;
    tasteProfile?: PlaylistCandidateTrack["tasteProfile"];
    vibeProfile?: PlaylistCandidateTrack["vibeProfile"];
    musicFamily?: MusicFamily;
    rootMusicFamily?: MusicFamily;
    sharedTags?: string[];
    lastfmMatch?: number;
    leftField?: boolean;
  },
  pathRoute: PathRoute,
): PoolTrack {
  const directionLabel = candidate.leftField
    ? "left-field"
    : pickDirectionLabel(candidate.vibeDirectionHints);

  return attachCandidateDebug(
    {
      title: candidate.title,
      artist: candidate.artist,
      reason: candidate.reason,
      confidence: candidate.confidence,
      source: candidate.source,
      spotifyUri: candidate.spotifyUri,
      spotifyId: candidate.spotifyId,
      previewUrl: candidate.previewUrl ?? null,
      artworkUrl: candidate.artworkUrl ?? null,
      directionLabel,
      pathRoute,
      vibeDirectionHints: candidate.vibeDirectionHints,
      tasteProfile: candidate.tasteProfile,
      vibeProfile: candidate.vibeProfile,
    },
    {
      taste: candidate.tasteProfileFull,
      vibe: candidate.vibeProfileFull,
      tasteCloseness: candidate.tasteCloseness,
    },
  ) as PoolTrack;
}

function seedFamily(seed: GenreSceneSeedEntry): MusicFamily {
  return seed.family ?? "unknown";
}

function isSeedAllowedForHole(
  seed: GenreSceneSeedEntry,
  hole: PathRoute,
  rootFamily: MusicFamily,
): boolean {
  const family = seedFamily(seed);
  const compat = assessFamilyCompatibility(rootFamily, family, hole);
  return compat.allowed;
}

export function isRealCandidate(track: PoolTrack): boolean {
  return track.source !== "curated_fallback";
}

export function realCandidateCount(tracks: PoolTrack[]): number {
  return tracks.filter(isRealCandidate).length;
}

export function pickBestFallbackSeed(rootFamily: MusicFamily): GenreSceneSeedEntry {
  const familyId = FAMILY_DEFAULT_SEED_ID[rootFamily] ?? DEFAULT_GENRE_SEED_ID;
  const byFamily = GENRE_SCENE_SEEDS.find((seed) => seed.id === familyId);
  if (byFamily) return byFamily;

  return (
    GENRE_SCENE_SEEDS.find((seed) => seed.id === DEFAULT_GENRE_SEED_ID) ??
    GENRE_SCENE_SEEDS[0]!
  );
}

export function fallbackSeedsForHole(
  hole: PathRoute,
  rootFamily: MusicFamily,
): SeedWithEntry[] {
  const seed = pickBestFallbackSeed(rootFamily);
  if (!isSeedAllowedForHole(seed, hole, rootFamily)) return [];

  return seed.tracks.slice(0, MAX_FALLBACK_PER_HOLE).map((track) => ({
    track,
    seedEntry: seed,
  }));
}

export function scoreForHole(track: PoolTrack, route: PathRoute): number {
  return scoreForPlaylist(track, track.rootMusicFamily ?? "unknown", new Set(), route);
}

function isRootArtist(artistLabel: string, rootArtistNames: Set<string>): boolean {
  return rootArtistNames.has(normalise(primaryArtistName(artistLabel)));
}

function isPlayableTrack(track: PoolTrack): boolean {
  return Boolean(track.spotifyUri && track.spotifyId);
}

export function scoreForPlaylist(
  track: PoolTrack,
  rootFamily: MusicFamily,
  rootArtistNames: Set<string>,
  gateRoute: PathRoute = "adjacent",
): number {
  let score = track.confidence;
  const closeness = track.tasteCloseness ?? 0.5;

  if (track.lastfmMatch !== undefined) {
    score += track.lastfmMatch * 0.12;
  }
  if (track.sharedTags && track.sharedTags.length > 0) {
    score += Math.min(track.sharedTags.length * 0.04, 0.16);
  }
  score += closeness * 0.1;

  if (isRootArtist(track.artist, rootArtistNames)) {
    score -= 0.22;
  }

  const candidateFamily = resolveCandidateFamily(track);
  const compat = assessFamilyCompatibility(
    rootFamily,
    candidateFamily,
    gateRoute,
    track.lastfmMatch ?? 0,
  );
  if (!compat.allowed) {
    score -= 0.35;
  } else if (compat.label === "left-field") {
    score -= 0.08;
  }

  if (rootFamily !== "pop" && isPopOrMainstreamArtist(track.artist)) {
    score -= 0.2;
  }

  if (OBVIOUS_HIT_TITLES.test(track.title)) {
    score -= rootFamily === "pop" ? 0.05 : 0.18;
  }

  if (track.source === "musicbrainz_related_recording") {
    score += 0.04;
  }

  return score;
}

function maxTracksForArtist(
  artistLabel: string,
  rootArtistNames: Set<string>,
  poolSize: number,
  relax: boolean,
): number {
  if (isRootArtist(artistLabel, rootArtistNames)) {
    return MAX_ROOT_ARTIST_TRACKS;
  }
  if (relax) return MAX_OTHER_ARTIST_THIN_POOL;
  return poolSize < THIN_POOL_THRESHOLD
    ? MAX_OTHER_ARTIST_THIN_POOL
    : MAX_OTHER_ARTIST_DEFAULT;
}

export function selectTracksForPlaylist(input: {
  pool: PoolTrack[];
  rootFamily: MusicFamily;
  rootArtistNames: Set<string>;
  rootTrackId: string;
  target?: number;
  min?: number;
  debugRows?: CandidateDebugRow[];
}): PoolTrack[] {
  const target = input.target ?? PLAYLIST_TARGET;
  const min = input.min ?? PLAYLIST_MIN;
  const debugRows = input.debugRows ?? [];
  const playable = input.pool.filter(
    (track) =>
      isPlayableTrack(track) &&
      track.spotifyId !== input.rootTrackId &&
      track.source !== "curated_fallback",
  );

  const scoreAndSort = () =>
    [...playable]
      .map((track) => ({
        track,
        score: scoreForPlaylist(track, input.rootFamily, input.rootArtistNames),
      }))
      .sort((a, b) => b.score - a.score)
      .map((entry) => entry.track);

  const selected: PoolTrack[] = [];
  const artistCounts = new Map<string, number>();
  const localUsed = new Set<string>();

  const trySelect = (sorted: PoolTrack[], relax: boolean) => {
    for (const track of sorted) {
      if (selected.length >= target) break;
      const key = dedupeKey(track);
      if (localUsed.has(key)) continue;

      const gate = isTrackAllowedForHole(track, "adjacent", input.rootFamily);
      debugRows.push({
        title: track.title,
        artist: track.artist,
        hole: "pool",
        musicFamily: track.musicFamily ?? "unknown",
        rootMusicFamily: input.rootFamily,
        sharedTags: track.sharedTags ?? [],
        score: scoreForPlaylist(track, input.rootFamily, input.rootArtistNames),
        rejectedReason: gate.allowed ? undefined : gate.reason,
        accepted: gate.allowed,
      });
      if (!gate.allowed && !relax) continue;

      const artistKey = normalise(primaryArtistName(track.artist));
      const count = artistCounts.get(artistKey) ?? 0;
      const maxForArtist = maxTracksForArtist(
        track.artist,
        input.rootArtistNames,
        playable.length,
        relax,
      );
      if (count >= maxForArtist) continue;

      selected.push(track);
      localUsed.add(key);
      artistCounts.set(artistKey, count + 1);
    }
  };

  trySelect(scoreAndSort(), false);

  if (selected.length < min) {
    trySelect(scoreAndSort(), true);
  }

  if (selected.length < min) {
    for (const track of scoreAndSort()) {
      if (selected.length >= min) break;
      const key = dedupeKey(track);
      if (localUsed.has(key)) continue;
      selected.push(track);
      localUsed.add(key);
    }
  }

  return selected.slice(0, target);
}

function demoFallbackTracks(rootFamily: MusicFamily): PoolTrack[] {
  const seed = pickBestFallbackSeed(rootFamily);
  return seed.tracks.slice(0, PLAYLIST_MIN).map((track) => ({
    title: track.title,
    artist: track.artist,
    reason: "Curated demo pick",
    confidence: 0.5,
    source: "curated_fallback" as const,
    pathRoute: "adjacent" as const,
    musicFamily: seed.family ?? "unknown",
    rootMusicFamily: rootFamily,
  }));
}

export function resolveCandidateFamily(track: PoolTrack): MusicFamily {
  if (track.musicFamily && track.musicFamily !== "unknown") {
    return track.musicFamily;
  }
  if (isMetalOrRockArtist(track.artist)) return "metal";
  if (isPopOrMainstreamArtist(track.artist)) return "pop";
  return track.musicFamily ?? "unknown";
}

export function isTrackAllowedForHole(
  track: PoolTrack,
  hole: PathRoute,
  rootFamily: MusicFamily,
): { allowed: boolean; reason?: string; leftField?: boolean } {
  const candidateFamily = resolveCandidateFamily(track);
  const compat = assessFamilyCompatibility(
    rootFamily,
    candidateFamily,
    hole,
    track.lastfmMatch ?? 0,
  );

  if (hole === "familiar" && !compat.allowed) {
    return { allowed: false, reason: compat.rejectReason };
  }

  if (hole === "stranger" && !getAllowedFamilies(rootFamily).includes(candidateFamily)) {
    return { allowed: true, leftField: true };
  }

  return { allowed: true, leftField: compat.label === "left-field" };
}

async function enrichTrackPreviews(
  tracks: PlaylistCandidateTrack[],
): Promise<PlaylistCandidateTrack[]> {
  const withSpotifyIds = await Promise.all(
    tracks.map(async (track) => {
      if (track.spotifyId) return track;

      const artist = primaryArtistName(track.artist);
      const results = await searchTracksByArtistEnhanced(artist, 8);
      const titleNorm = normalise(track.title);
      const match =
        results.find((candidate) => normalise(candidate.name) === titleNorm) ??
        results.find((candidate) => normalise(candidate.name).includes(titleNorm)) ??
        results[0];
      if (!match) return track;

      return {
        ...track,
        spotifyUri: match.uri,
        spotifyId: match.id,
        previewUrl: track.previewUrl ?? match.previewUrl,
        artworkUrl: track.artworkUrl ?? match.imageUrl,
      };
    }),
  );

  const ids = withSpotifyIds
    .filter((track) => track.spotifyId && (!track.previewUrl || !track.artworkUrl))
    .map((track) => track.spotifyId!);
  if (ids.length === 0) return withSpotifyIds;
  const details = await fetchTrackDetails(ids);
  return withSpotifyIds.map((track) => {
    if (!track.spotifyId) return track;
    const extra = details.get(track.spotifyId);
    if (!extra) return track;
    return {
      ...track,
      previewUrl: track.previewUrl ?? extra.previewUrl,
      artworkUrl: track.artworkUrl ?? extra.imageUrl,
    };
  });
}

export function seedToTrack(
  seed: SeedTrack,
  route: PathRoute,
  rootFamily: MusicFamily,
  seedEntry: GenreSceneSeedEntry,
): PoolTrack {
  const family = seedFamily(seedEntry);
  return {
    title: seed.title,
    artist: seed.artist,
    reason: `Curated ${route} pick`,
    confidence: route === "stranger" ? 0.48 : 0.52,
    source: "curated_fallback",
    pathRoute: route,
    musicFamily: family,
    rootMusicFamily: rootFamily,
  };
}

export function poolForRoute(pool: PoolTrack[], route: PathRoute): PoolTrack[] {
  if (route !== "familiar") return pool;
  return pool.filter(
    (track) =>
      track.pathRoute !== "stranger" || track.source !== "curated_fallback",
  );
}

export async function buildCandidatePool(
  story: StoryCandidateInput,
): Promise<{
  pool: PoolTrack[];
  fallbackUsed: boolean;
  rootMusicFamily: MusicFamily;
  spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[];
  unresolvedSimilarArtists: UnresolvedSimilarArtist[];
  lastfmSimilarArtists: Array<{ name: string; match: number }>;
}> {
  const rootUri = `spotify:track:${story.rootTrack.spotifyId ?? story.rootTrack.id}`;
  const seenUris = new Set<string>([rootUri]);
  const rootArtistNames = new Set(
    story.rootTrack.artists.map((artist) => normalise(artist.name)),
  );
  const rootArtistName =
    story.rootTrack.artists[0]?.name ?? formatArtists(story.rootTrack);

  const spotifyBudget = createSpotifyBudget(false);

  const lastfm = await collectLastfmCandidates({
    rootArtistName,
    rootTrackTitle: story.rootTrack.title,
    rootTrackId: story.rootTrack.id,
    rootArtistNames,
    seenUris,
    spotifyBudget,
  });

  const rootFamily = lastfm.rootMusicFamily;

  const pool: PoolTrack[] = lastfm.candidates.map((candidate) =>
      toPlaylistTrack(
        {
          title: candidate.title,
          artist: candidate.artist,
          reason: candidate.reason,
          confidence: candidate.confidence,
          source: candidate.source,
          spotifyUri: candidate.spotifyUri,
          spotifyId: candidate.spotifyId,
          previewUrl: candidate.previewUrl,
          artworkUrl: candidate.artworkUrl,
          vibeDirectionHints: candidate.vibeDirectionHints,
          tasteCloseness: candidate.tasteCloseness,
          tasteProfileFull: candidate.tasteProfileFull,
          vibeProfileFull: candidate.vibeProfileFull,
          tasteProfile: candidate.tasteProfile,
          vibeProfile: candidate.vibeProfile,
          musicFamily: candidate.musicFamily,
          rootMusicFamily: rootFamily,
          sharedTags: candidate.sharedTags,
          lastfmMatch: candidate.lastfmMatch,
          leftField:
            candidate.pathRoute === "stranger" &&
            candidate.musicFamily !== undefined &&
            !getAllowedFamilies(rootFamily).includes(candidate.musicFamily),
        },
        candidate.pathRoute ?? assignPathRoute({
          tasteCloseness: candidate.tasteCloseness ?? 0.5,
          rootFamily,
          candidateFamily: candidate.musicFamily ?? "unknown",
          strongSharedTagCount: candidate.sharedTags?.length ?? 0,
          lastfmMatch: candidate.lastfmMatch,
        }),
      ),
    );

  let fallbackUsed = false;

  const lastfmCount = pool.filter(
    (track) =>
      track.source === "lastfm_similar_artist" || track.source === "lastfm_tag_seed",
  ).length;

  // Spotify backfill removed — resolution happens in collectLastfmCandidates with strict budget.

  for (const connected of story.connectedTracks ?? []) {
    if (!connected.spotifyUri || !connected.spotifyId) continue;
    if (connected.spotifyId === story.rootTrack.id || seenUris.has(connected.spotifyUri)) {
      continue;
    }
    seenUris.add(connected.spotifyUri);
    pool.push(
      toPlaylistTrack(
        {
          title: connected.title,
          artist: connected.artist,
          reason: `MusicBrainz connection — ${connected.relationship}`,
          confidence: 0.56,
          source: "musicbrainz_related_recording",
          spotifyUri: connected.spotifyUri,
          spotifyId: connected.spotifyId,
          previewUrl: connected.previewUrl,
          artworkUrl: connected.artworkUrl,
          musicFamily: rootFamily,
          rootMusicFamily: rootFamily,
        },
        "adjacent",
      ),
    );
  }

  // Only mark fallback when Last.fm returned nothing useful — never bulk-fill the pool with seeds.
  if (lastfmCount === 0 && pool.length < HOLE_MIN_BEFORE_FALLBACK) {
    fallbackUsed = true;
  }

  return {
    pool,
    fallbackUsed,
    rootMusicFamily: rootFamily,
    spotifyDiagnostics: lastfm.spotifyDiagnostics,
    unresolvedSimilarArtists: lastfm.unresolvedSimilarArtists,
    lastfmSimilarArtists: lastfm.lastfmSimilarArtists,
  };
}

function isDemoFallbackEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_FALLBACK === "true";
}

function buildSimilarArtistPreview(input: {
  lastfmSimilarArtists: Array<{ name: string; match: number }>;
  spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[];
  unresolvedSimilarArtists: UnresolvedSimilarArtist[];
}): LastfmSimilarArtistPreview[] {
  const diagnosticByName = new Map(
    input.spotifyDiagnostics.map((row) => [row.artistName.toLowerCase(), row]),
  );
  const unresolvedByName = new Map(
    input.unresolvedSimilarArtists.map((row) => [row.lastfmArtist.toLowerCase(), row]),
  );

  return input.lastfmSimilarArtists.map((artist) => {
    const diagnostic = diagnosticByName.get(artist.name.toLowerCase());
    const unresolved = unresolvedByName.get(artist.name.toLowerCase());
    const spotifyResolved = (diagnostic?.selectedTrackCount ?? 0) > 0;

    return {
      name: artist.name,
      matchScore: artist.match,
      spotifyResolved,
      note: spotifyResolved
        ? `${diagnostic?.selectedTrackCount ?? 0} Spotify track(s) resolved`
        : unresolved?.reason ?? diagnostic?.unresolvedReason ?? "Spotify URI not resolved",
    };
  });
}

function buildDiscoveryState(input: {
  pool: PoolTrack[];
  spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[];
  unresolvedSimilarArtists: UnresolvedSimilarArtist[];
  lastfmSimilarArtists: Array<{ name: string; match: number }>;
  demoFallbackActive: boolean;
  servedFromCache?: boolean;
  partialDueToRateLimit?: boolean;
}): RabbitHoleDiscoveryState {
  const poolRealCount = realCandidateCount(input.pool);
  const spotifyRateLimited =
    isSpotifyRateLimited() || wasSpotifyRateLimitedInDiagnostics(input.spotifyDiagnostics);
  const similarArtists = buildSimilarArtistPreview(input);

  if (input.servedFromCache && poolRealCount > 0) {
    return {
      status: "cached",
      message: "",
      spotifyRateLimited,
      realCandidateCount: poolRealCount,
      demoFallbackActive: input.demoFallbackActive,
      similarArtists,
      servedFromCache: true,
    };
  }

  if (poolRealCount > 0) {
    return {
      status: input.partialDueToRateLimit ? "ready" : "ready",
      message: input.partialDueToRateLimit
        ? "Some recommendations may be missing while Spotify catches up."
        : "",
      spotifyRateLimited,
      realCandidateCount: poolRealCount,
      demoFallbackActive: input.demoFallbackActive,
      similarArtists,
      partialDueToRateLimit: input.partialDueToRateLimit,
    };
  }

  if (spotifyRateLimited) {
    return {
      status: "warming_up",
      message:
        "Recommendations are warming up — Spotify search is temporarily rate-limited. Try again shortly.",
      spotifyRateLimited: true,
      realCandidateCount: 0,
      demoFallbackActive: input.demoFallbackActive,
      similarArtists,
    };
  }

  return {
    status: "unavailable",
    message: "We couldn't build a playable playlist for this track right now.",
    spotifyRateLimited: false,
    realCandidateCount: 0,
    demoFallbackActive: input.demoFallbackActive,
    similarArtists,
  };
}

export type PlaylistGenerationResult = {
  playlists: PlaylistCandidate[];
  discovery: RabbitHoleDiscoveryState;
};

/** @deprecated Alias for playlist generation result. */
export type RabbitHoleGenerationResult = PlaylistGenerationResult;

export async function generatePlaylistWithDiscovery(
  story: StoryCandidateInput,
): Promise<PlaylistGenerationResult> {
  if (isRecommendationFixturesEnabled()) {
    const fixture = await generateFixturePlaylist({ rootTrack: story.rootTrack });
    if (fixture) {
      return {
        playlists: fixture.playlists,
        discovery: { ...fixture.discovery, fixtureMode: true },
      };
    }
  }

  const metrics = beginRecommendationMetrics();
  const rootArtistName =
    story.rootTrack.artists[0]?.name ?? formatArtists(story.rootTrack);
  const cacheKey = recommendationCacheKey({
    rootTrackId: story.rootTrack.id,
    rootArtistName,
    rootTrackTitle: story.rootTrack.title,
  });

  const cached = await getCachedRecommendation(cacheKey);
  if (cached && cached.playlists.some((p) => p.tracks.length > 0)) {
    metrics.playlistCacheHit = true;
    metrics.servedFromCache = true;
    const discovery = {
      ...cached.discovery,
      status: "cached" as const,
      servedFromCache: true,
    };
    logRecommendationMetrics(`${rootArtistName} / ${story.rootTrack.title}`, metrics);
    endRecommendationMetrics();
    return { playlists: cached.playlists, discovery };
  }

  const poolResult = await buildCandidatePool(story);
  const {
    pool,
    rootMusicFamily,
    spotifyDiagnostics,
    unresolvedSimilarArtists,
    lastfmSimilarArtists,
  } = poolResult;
  const demoFallbackActive = isDemoFallbackEnabled();
  const partialDueToRateLimit =
    isSpotifyRateLimited() || wasSpotifyRateLimitedInDiagnostics(spotifyDiagnostics);

  const discovery = buildDiscoveryState({
    pool,
    spotifyDiagnostics,
    unresolvedSimilarArtists,
    lastfmSimilarArtists,
    demoFallbackActive,
    partialDueToRateLimit,
  });

  const rootArtistNames = new Set(
    story.rootTrack.artists.map((artist) => normalise(artist.name)),
  );
  const rootTrackTitle = story.rootTrack.title;
  const poolHasRealCandidates = realCandidateCount(pool) > 0;
  const debugRows: CandidateDebugRow[] = [];
  let selected: PoolTrack[] = [];
  let fallbackUsed = false;

  if (poolHasRealCandidates) {
    selected = selectTracksForPlaylist({
      pool,
      rootFamily: rootMusicFamily,
      rootArtistNames,
      rootTrackId: story.rootTrack.id,
      debugRows,
    });
  } else if (demoFallbackActive) {
    selected = demoFallbackTracks(rootMusicFamily);
    fallbackUsed = true;
  } else {
    logCandidateDebug(debugRows);
    logRecommendationMetrics(`${rootArtistName} / ${story.rootTrack.title}`, metrics);
    endRecommendationMetrics();
    return { playlists: [], discovery };
  }

  logCandidateDebug(debugRows);
  const enriched = await enrichTrackPreviews(selected);
  const playable = enriched.filter((track) => Boolean(track.spotifyUri));

  if (playable.length < PLAYLIST_MIN && !demoFallbackActive) {
    logRecommendationMetrics(`${rootArtistName} / ${story.rootTrack.title}`, metrics);
    endRecommendationMetrics();
    return { playlists: [], discovery };
  }

  const tracks = playable.length >= PLAYLIST_MIN ? playable : enriched;

  const playlist: PlaylistCandidate = {
    id: `you-might-also-like-${story.rootTrack.id}`,
    name: `Because you like ${rootTrackTitle}`,
    description: "A mini playlist built from nearby artists, tags and scenes.",
    vibe: "Discovery",
    trackCount: tracks.length,
    seedTrackId: story.rootTrack.id,
    tracks,
    fallbackUsed: fallbackUsed || tracks.some((t) => t.source === "curated_fallback"),
    demoFallback: demoFallbackActive && tracks.some((t) => t.source === "curated_fallback"),
  };

  const result = { playlists: [playlist], discovery };
  await setCachedRecommendation(cacheKey, {
    playlists: result.playlists,
    discovery: result.discovery,
    cachedAt: Date.now(),
  });

  logRecommendationMetrics(`${rootArtistName} / ${story.rootTrack.title}`, metrics);
  endRecommendationMetrics();
  return result;
}

/** @deprecated Use generatePlaylistWithDiscovery. */
export async function generateRabbitHolesWithDiscovery(
  story: StoryCandidateInput,
): Promise<PlaylistGenerationResult> {
  return generatePlaylistWithDiscovery(story);
}

export async function generateRabbitHoles(
  story: StoryCandidateInput,
): Promise<PlaylistCandidate[]> {
  const { playlists } = await generatePlaylistWithDiscovery(story);
  return playlists;
}

export async function generateMiniPlaylist(
  story: StoryCandidateInput,
): Promise<PlaylistCandidate> {
  const { playlists } = await generatePlaylistWithDiscovery(story);
  if (playlists[0]) return playlists[0];
  return {
    id: `you-might-also-like-${story.rootTrack.id}`,
    name: `Because you like ${story.rootTrack.title}`,
    description: "A mini playlist built from nearby artists, tags and scenes.",
    vibe: "Discovery",
    trackCount: 0,
    seedTrackId: story.rootTrack.id,
    tracks: [],
  };
}

export async function generatePlaylistCandidates(
  story: StoryCandidateInput,
): Promise<PlaylistGenerationResult> {
  return generatePlaylistWithDiscovery(story);
}

export { getMusicFamily } from "./music-family";
