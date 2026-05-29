import { cacheGet } from "../cache/persistent-store";
import {
  getLastfmArtistTags,
  getLastfmArtistTopTracks,
  getLastfmSimilarArtists,
  getLastfmTagTopArtists,
  isLastfmEnabled,
  type LastfmTag,
} from "../lastfm";
import {
  getActiveRecommendationMetrics,
  recordRateLimitEvent,
} from "../recommendation-metrics";
import {
  assessFamilyCompatibility,
  assignPathRoute,
  filterStrongTags,
  getAllowedFamilies,
  getMusicFamily,
  isWeakFamilyTag,
  logCandidateDebug,
  sharedStrongTags,
  type CandidateDebugRow,
  type MusicFamily,
} from "../music-family";
import { resolveSpotifyTrack } from "../spotify-resolver";
import {
  createSpotifyBudget,
  isSpotifyGloballyRateLimited,
  type SpotifyBudget,
} from "../spotify-throttle";
import type { SimilarArtistSpotifyDiagnostic, UnresolvedSimilarArtist } from "../spotify-artist-search";
import {
  compareTasteProfiles,
  summariseTasteProfile,
  tagsToTasteProfile,
  type TasteProfile,
} from "../tasteProfile";
import {
  buildVibeCandidateReason,
  compareVibeProfiles,
  deriveVibeProfile,
  getVibeDirectionHints,
  summariseVibeProfile,
  tagsToWeightedTags,
  type VibeProfile,
} from "../vibeProfile";
import {
  enrichRootTags,
  sceneTagMatchBonus,
  type RootTagEnrichment,
} from "../tag-enrichment";
import type { BeyondCandidate } from "./types";

const MAX_LASTFM_CANDIDATES = 48;
const TRACKS_PER_SIMILAR_ARTIST = 2;
const MAX_SIMILAR_ARTISTS = 20;
const MAX_TAG_SEED_ARTISTS = 8;
const MAX_SPOTIFY_RESOLUTIONS = 30;

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function toCandidateKey(title: string, artist: string): string {
  return `${normalise(title)}|${normalise(artist)}`;
}

function sharedTagNames(
  rootTags: Array<{ name: string }>,
  candidateTags: Array<{ name: string }>,
): string[] {
  const rootSet = new Set(rootTags.map((tag) => normalise(tag.name)));
  return candidateTags
    .map((tag) => tag.name)
    .filter((name) => rootSet.has(normalise(name)))
    .slice(0, 4);
}

function onlyWeakSharedTags(
  rootTags: Array<{ name: string; weight?: number }>,
  candidateTags: Array<{ name: string; weight?: number }>,
): boolean {
  const shared = sharedTagNames(rootTags, candidateTags);
  if (shared.length === 0) return false;
  return shared.every((tag) => isWeakFamilyTag(tag));
}

type LastfmOnlyCandidate = {
  title: string;
  artist: string;
  connectionType: "lastfm_similar_artist" | "lastfm_tag_seed";
  lastfmMatch: number;
  tasteCloseness: number;
  candidateTaste: TasteProfile;
  candidateVibe: VibeProfile;
  candidateFamily: MusicFamily;
  sharedTags: string[];
  strongSharedTags: string[];
  weakTagsOnly: boolean;
  sceneBonus: number;
  similarArtistName?: string;
  tagName?: string;
  combinedScore: number;
};

type RankedLastfmCandidate = BeyondCandidate & {
  lastfmMatch: number;
  tasteCloseness: number;
  vibeCloseness: number;
  combinedScore: number;
  musicFamily: MusicFamily;
};

function scoreLastfmOnly(input: {
  lastfmMatch: number;
  tasteCloseness: number;
  vibeCloseness: number;
  strongSharedTags: string[];
  sceneBonus: number;
  rootFamily: MusicFamily;
  candidateFamily: MusicFamily;
}): number {
  const strongTagBonus = input.strongSharedTags.length * 0.08;
  const familyAllowed = getAllowedFamilies(input.rootFamily).includes(input.candidateFamily);
  const familyPenalty = familyAllowed ? 0 : 0.35;

  return (
    input.tasteCloseness * 0.3 +
    input.lastfmMatch * 0.22 +
    input.vibeCloseness * 0.15 +
    strongTagBonus +
    input.sceneBonus -
    familyPenalty
  );
}

function toRankedCandidate(input: {
  lastfm: LastfmOnlyCandidate;
  track: {
    id: string;
    uri: string;
    name: string;
    artistLabel: string;
    previewUrl?: string | null;
    imageUrl?: string | null;
  };
  rootTaste: TasteProfile;
  rootVibe: VibeProfile;
  rootTags: LastfmTag[];
  rootFamily: MusicFamily;
}): RankedLastfmCandidate {
  const vibeCloseness = compareVibeProfiles(input.lastfm.candidateVibe, input.rootVibe);
  const directionHints = getVibeDirectionHints(input.lastfm.candidateVibe, input.rootVibe);
  const pathRoute = assignPathRoute({
    tasteCloseness: input.lastfm.tasteCloseness,
    rootFamily: input.rootFamily,
    candidateFamily: input.lastfm.candidateFamily,
    strongSharedTagCount: input.lastfm.strongSharedTags.length,
    lastfmMatch: input.lastfm.lastfmMatch,
    weakTagsOnly: input.lastfm.weakTagsOnly,
  });

  const reason = buildVibeCandidateReason({
    candidateVibe: input.lastfm.candidateVibe,
    rootVibe: input.rootVibe,
    similarArtist: input.lastfm.similarArtistName,
    sharedTags:
      input.lastfm.strongSharedTags.length > 0
        ? input.lastfm.strongSharedTags
        : input.lastfm.sharedTags,
    tasteCloseness: input.lastfm.tasteCloseness,
    source: input.lastfm.connectionType,
  });

  return {
    key: toCandidateKey(input.track.name, input.track.artistLabel),
    title: input.track.name,
    artist: input.track.artistLabel,
    spotifyUri: input.track.uri,
    spotifyId: input.track.id,
    previewUrl: input.track.previewUrl ?? null,
    artworkUrl: input.track.imageUrl ?? null,
    connectionType: input.lastfm.connectionType,
    source: input.lastfm.connectionType,
    reason,
    confidence: Math.min(0.96, 0.55 + input.lastfm.combinedScore * 0.4),
    musicalAdjacencyScore: Math.round(input.lastfm.combinedScore * 10),
    matchMethod: "exact_artist",
    tasteProfile: summariseTasteProfile(input.lastfm.candidateTaste),
    vibeProfile: summariseVibeProfile(input.lastfm.candidateVibe),
    vibeDirectionHints: directionHints,
    tasteProfileFull: input.lastfm.candidateTaste,
    vibeProfileFull: input.lastfm.candidateVibe,
    tasteCloseness: input.lastfm.tasteCloseness,
    vibeCloseness,
    lastfmMatch: input.lastfm.lastfmMatch,
    musicFamily: input.lastfm.candidateFamily,
    sharedTags:
      input.lastfm.strongSharedTags.length > 0
        ? input.lastfm.strongSharedTags
        : input.lastfm.sharedTags,
    pathRoute,
    combinedScore: input.lastfm.combinedScore,
    searchedPerson: input.lastfm.similarArtistName ?? input.lastfm.tagName,
  };
}

export type LastfmCollectionResult = {
  candidates: BeyondCandidate[];
  rootTags: LastfmTag[];
  rootTaste: TasteProfile | null;
  rootVibe: VibeProfile | null;
  rootMusicFamily: MusicFamily;
  rootTagEnrichment: RootTagEnrichment | null;
  similarArtistNames: string[];
  lastfmSimilarArtists: Array<{ name: string; match: number }>;
  spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[];
  unresolvedSimilarArtists: UnresolvedSimilarArtist[];
  lastfmEnabled: boolean;
  candidatesBeforeSpotify: number;
};

async function detectWarmSpotifyStart(rootArtistName: string): Promise<boolean> {
  const similarKey = `${normalise(rootArtistName)}:${MAX_SIMILAR_ARTISTS}`;
  const similarCached = await cacheGet<unknown[]>("lastfmSimilarArtists", similarKey);
  return similarCached !== null;
}

export async function collectLastfmCandidates(input: {
  rootArtistName: string;
  rootTrackTitle: string;
  rootTrackId: string;
  rootArtistNames: Set<string>;
  seenUris: Set<string>;
  spotifyBudget?: SpotifyBudget;
}): Promise<LastfmCollectionResult> {
  const emptyResult: LastfmCollectionResult = {
    candidates: [],
    rootTags: [],
    rootTaste: null,
    rootVibe: null,
    rootMusicFamily: "unknown",
    rootTagEnrichment: null,
    similarArtistNames: [],
    lastfmSimilarArtists: [],
    spotifyDiagnostics: [],
    unresolvedSimilarArtists: [],
    lastfmEnabled: false,
    candidatesBeforeSpotify: 0,
  };

  if (!isLastfmEnabled()) return emptyResult;

  const warmStart = await detectWarmSpotifyStart(input.rootArtistName);
  const budget = input.spotifyBudget ?? createSpotifyBudget(warmStart);

  const rootEnrichment = await enrichRootTags({
    artistName: input.rootArtistName,
    trackTitle: input.rootTrackTitle,
  });
  const rootTags = rootEnrichment.tags;
  const rootTaste = rootEnrichment.tasteProfile;
  const rootVibe = rootEnrichment.vibeProfile;
  const rootFamily = rootEnrichment.musicFamily;
  const emptyTaste = tagsToTasteProfile([]);
  const emptyVibe = deriveVibeProfile(emptyTaste, []);

  const similarArtists = await getLastfmSimilarArtists(
    input.rootArtistName,
    MAX_SIMILAR_ARTISTS,
  );

  const lastfmOnly: LastfmOnlyCandidate[] = [];
  const similarArtistNames: string[] = [];
  const lastfmSimilarArtists: Array<{ name: string; match: number }> = [];
  const debugRows: CandidateDebugRow[] = [];
  const usedKeys = new Set<string>();

  for (const similar of similarArtists) {
    if (input.rootArtistNames.has(normalise(similar.name))) continue;
    similarArtistNames.push(similar.name);
    lastfmSimilarArtists.push({ name: similar.name, match: similar.match });

    const [candidateTags, topTracks] = await Promise.all([
      getLastfmArtistTags(similar.name),
      getLastfmArtistTopTracks(similar.name, TRACKS_PER_SIMILAR_ARTIST + 1),
    ]);

    const candidateWeightedTags = tagsToWeightedTags(candidateTags);
    const candidateTaste =
      candidateTags.length > 0 ? tagsToTasteProfile(candidateTags) : (rootTaste ?? emptyTaste);
    const candidateVibe = deriveVibeProfile(candidateTaste, candidateWeightedTags);
    const candidateFamily = getMusicFamily(candidateTaste, candidateTags);
    const tasteCloseness = rootTaste
      ? compareTasteProfiles(candidateTaste, rootTaste)
      : similar.match;
    const sharedTags = sharedTagNames(rootTags, candidateTags);
    const strongTags = sharedStrongTags(rootTags, candidateTags);
    const weakTagsOnly = onlyWeakSharedTags(rootTags, candidateTags);
    const sceneBonus = sceneTagMatchBonus(rootTags, candidateTags);
    const vibeCloseness = compareVibeProfiles(candidateVibe, rootVibe ?? emptyVibe);
    const combinedScore = scoreLastfmOnly({
      lastfmMatch: similar.match,
      tasteCloseness,
      vibeCloseness,
      strongSharedTags: strongTags,
      sceneBonus,
      rootFamily,
      candidateFamily,
    });

    for (const topTrack of topTracks.slice(0, TRACKS_PER_SIMILAR_ARTIST)) {
      const key = toCandidateKey(topTrack.name, topTrack.artist);
      if (usedKeys.has(key)) continue;
      usedKeys.add(key);

      lastfmOnly.push({
        title: topTrack.name,
        artist: topTrack.artist,
        connectionType: "lastfm_similar_artist",
        lastfmMatch: similar.match,
        tasteCloseness,
        candidateTaste,
        candidateVibe,
        candidateFamily,
        sharedTags,
        strongSharedTags: strongTags,
        weakTagsOnly,
        sceneBonus,
        similarArtistName: similar.name,
        combinedScore,
      });
    }
  }

  if (lastfmOnly.length < MAX_LASTFM_CANDIDATES && rootTags.length > 0) {
    const topTags = filterStrongTags(rootTags).slice(0, 2);
    const tagPool = topTags.length > 0 ? topTags : rootTags.slice(0, 2);

    for (const tag of tagPool) {
      if (isWeakFamilyTag(tag.name)) continue;
      const tagArtists = await getLastfmTagTopArtists(tag.name, MAX_TAG_SEED_ARTISTS);

      for (const tagArtist of tagArtists) {
        if (input.rootArtistNames.has(normalise(tagArtist.name))) continue;
        const alreadyUsed = lastfmOnly.some(
          (candidate) => normalise(candidate.artist) === normalise(tagArtist.name),
        );
        if (alreadyUsed) continue;

        const [candidateTags, topTracks] = await Promise.all([
          getLastfmArtistTags(tagArtist.name),
          getLastfmArtistTopTracks(tagArtist.name, 1),
        ]);
        const topTrack = topTracks[0];
        if (!topTrack) continue;

        const key = toCandidateKey(topTrack.name, topTrack.artist);
        if (usedKeys.has(key)) continue;
        usedKeys.add(key);

        const candidateWeightedTags = tagsToWeightedTags(candidateTags);
        const candidateTaste =
          candidateTags.length > 0 ? tagsToTasteProfile(candidateTags) : (rootTaste ?? emptyTaste);
        const candidateVibe = deriveVibeProfile(candidateTaste, candidateWeightedTags);
        const candidateFamily = getMusicFamily(candidateTaste, candidateTags);

        if (
          rootFamily !== "unknown" &&
          candidateFamily !== "unknown" &&
          !getAllowedFamilies(rootFamily).includes(candidateFamily)
        ) {
          continue;
        }

        const tasteCloseness = rootTaste
          ? compareTasteProfiles(candidateTaste, rootTaste)
          : (tag.weight ?? 0) * 0.8;
        const sharedTags = sharedTagNames(rootTags, candidateTags);
        const strongTags = sharedStrongTags(rootTags, candidateTags);
        const weakTagsOnly = onlyWeakSharedTags(rootTags, candidateTags);
        const sceneBonus = sceneTagMatchBonus(rootTags, candidateTags);
        const vibeCloseness = compareVibeProfiles(candidateVibe, rootVibe ?? emptyVibe);

        lastfmOnly.push({
          title: topTrack.name,
          artist: topTrack.artist,
          connectionType: "lastfm_tag_seed",
          lastfmMatch: (tag.weight ?? 0) * 0.7,
          tasteCloseness,
          candidateTaste,
          candidateVibe,
          candidateFamily,
          sharedTags,
          strongSharedTags: strongTags,
          weakTagsOnly,
          sceneBonus,
          tagName: tag.name,
          combinedScore: scoreLastfmOnly({
            lastfmMatch: (tag.weight ?? 0) * 0.7,
            tasteCloseness,
            vibeCloseness,
            strongSharedTags: strongTags,
            sceneBonus,
            rootFamily,
            candidateFamily,
          }),
        });
      }
    }
  }

  lastfmOnly.sort((a, b) => b.combinedScore - a.combinedScore);
  const candidatesBeforeSpotify = lastfmOnly.length;
  const metrics = getActiveRecommendationMetrics();
  if (metrics) metrics.candidatesBeforeSpotify = candidatesBeforeSpotify;

  const toResolve = lastfmOnly.slice(0, MAX_SPOTIFY_RESOLUTIONS);
  const ranked: RankedLastfmCandidate[] = [];
  const spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[] = [];
  const unresolvedSimilarArtists: UnresolvedSimilarArtist[] = [];

  for (const candidate of toResolve) {
    if (isSpotifyGloballyRateLimited()) {
      recordRateLimitEvent();
      break;
    }

    const resolved = await resolveSpotifyTrack(budget, candidate.title, candidate.artist);
    const diagnostic: SimilarArtistSpotifyDiagnostic = {
      artistName: candidate.similarArtistName ?? candidate.artist,
      lastfmMatchScore: candidate.lastfmMatch,
      queries: [
        {
          query: `track:"${candidate.title}" artist:"${candidate.artist}"`,
          status: resolved ? 200 : isSpotifyGloballyRateLimited() ? 429 : 404,
          resultCount: resolved ? 1 : 0,
          selectedCount: resolved ? 1 : 0,
          rateLimited: isSpotifyGloballyRateLimited(),
        },
      ],
      selectedTrackCount: resolved ? 1 : 0,
      unresolvedReason: resolved ? undefined : "Spotify URI not resolved",
    };
    spotifyDiagnostics.push(diagnostic);

    if (!resolved?.uri || !resolved.id) {
      if (candidate.similarArtistName) {
        unresolvedSimilarArtists.push({
          lastfmArtist: candidate.similarArtistName,
          lastfmMatchScore: candidate.lastfmMatch,
          reason: diagnostic.unresolvedReason ?? "no Spotify URI resolved",
        });
      }
      continue;
    }

    if (input.seenUris.has(resolved.uri) || resolved.id === input.rootTrackId) continue;

    const rankedCandidate = toRankedCandidate({
      lastfm: candidate,
      track: resolved,
      rootTaste: rootTaste ?? emptyTaste,
      rootVibe: rootVibe ?? emptyVibe,
      rootTags,
      rootFamily,
    });

    const familiarCheck = assessFamilyCompatibility(
      rootFamily,
      rankedCandidate.musicFamily ?? "unknown",
      "familiar",
      candidate.lastfmMatch,
    );
    if (rankedCandidate.pathRoute === "familiar" && !familiarCheck.allowed) {
      rankedCandidate.pathRoute = "stranger";
    }

    debugRows.push({
      title: rankedCandidate.title,
      artist: rankedCandidate.artist,
      hole: rankedCandidate.pathRoute ?? "pool",
      musicFamily: rankedCandidate.musicFamily ?? "unknown",
      rootMusicFamily: rootFamily,
      sharedTags: rankedCandidate.sharedTags ?? [],
      score: rankedCandidate.combinedScore,
      accepted: true,
    });

    input.seenUris.add(resolved.uri);
    ranked.push(rankedCandidate);
    if (metrics) metrics.resolvedSpotifyUris += 1;
  }

  ranked.sort((a, b) => b.combinedScore - a.combinedScore);
  logCandidateDebug(debugRows);

  return {
    candidates: ranked.slice(0, MAX_LASTFM_CANDIDATES),
    rootTags,
    rootTaste,
    rootVibe,
    rootMusicFamily: rootFamily,
    rootTagEnrichment: rootEnrichment,
    similarArtistNames,
    lastfmSimilarArtists,
    spotifyDiagnostics,
    unresolvedSimilarArtists,
    lastfmEnabled: true,
    candidatesBeforeSpotify,
  };
}

export function countLastfmCandidates(candidates: BeyondCandidate[]): number {
  return candidates.filter(
    (candidate) =>
      candidate.source === "lastfm_similar_artist" ||
      candidate.source === "lastfm_tag_seed",
  ).length;
}

export type { LastfmTag };
