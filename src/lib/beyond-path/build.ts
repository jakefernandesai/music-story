import { formatArtists } from "../format";
import {
  DEFAULT_GENRE_SEED_ID,
  GENRE_SCENE_SEEDS,
  type GenreSceneSeedEntry,
  type SeedTrack,
} from "../playlist-seeds";
import {
  qualifiesAsPerformingArtist,
  searchSpotifyArtist,
  searchTracksByArtist,
  searchTracksForSpotifyArtist,
  type SpotifyArtistMatch,
  type SpotifyArtistSearchTrack,
} from "../spotify";
import { getAvailableVibeDirections, deriveVibeProfile } from "../vibeProfile";
import { attachCandidateDebug } from "../playlist-vibe-debug";
import type { MusicStory, StoryNode } from "../types";
import { computeMusicalAdjacencyScore, selectBeyondCandidates } from "./adjacency";
import { collectLastfmCandidates } from "./lastfm-candidates";
import type {
  BeyondCandidate,
  BeyondConnectionType,
  BeyondMatchMethod,
} from "./types";
import { BEYOND_LIMITS } from "./types";
import type { TasteProfile } from "../tasteProfile";

export type StoryBeyondInput = Pick<MusicStory, "rootTrack" | "nodes" | "edges">;

const PEOPLE_NODE_TYPES = new Set(["producer", "songwriter", "collaborator"]);

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function splitArtists(artistLabel: string): string[] {
  return artistLabel
    .split(/, | & | feat\. | ft\. | x /i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function nameMatches(a: string, b: string): boolean {
  const left = normalise(a);
  const right = normalise(b);
  return left === right || left.includes(right) || right.includes(left);
}

function classifyTrackMatch(
  searchedName: string,
  spotifyArtistId: string | undefined,
  track: SpotifyArtistSearchTrack,
): BeyondMatchMethod {
  const artistNames = splitArtists(track.artistLabel);
  const inArtists =
    (spotifyArtistId && track.artistIds?.includes(spotifyArtistId)) ||
    artistNames.some((artist) => nameMatches(artist, searchedName));

  const titleHasName = normalise(track.name).includes(normalise(searchedName));

  if (!inArtists && titleHasName) return "title_only";
  if (inArtists) return "exact_artist";
  return "none";
}

function rootTrackLabel(story: StoryBeyondInput): string {
  return `"${story.rootTrack.title}" by ${formatArtists(story.rootTrack)}`;
}

function getPeopleNodes(story: StoryBeyondInput): StoryNode[] {
  return story.nodes.filter((node) => PEOPLE_NODE_TYPES.has(node.type));
}

function scoreGenreSeed(
  seed: GenreSceneSeedEntry,
  story: StoryBeyondInput,
  genreNodes: StoryNode[],
  sceneNodes: StoryNode[],
): number {
  let score = 0;
  const corpus = [
    ...story.rootTrack.artists.map((artist) => artist.name),
    story.rootTrack.albumTitle,
    story.rootTrack.title,
    ...genreNodes.map((node) => node.title),
    ...sceneNodes.map((node) => node.title),
    ...story.nodes.map((node) => node.subtitle ?? ""),
  ]
    .join(" ")
    .toLowerCase();

  for (const keyword of seed.matchKeywords) {
    if (!keyword) continue;
    if (corpus.includes(keyword.toLowerCase())) score += 1;
  }

  if (genreNodes.some((node) => normalise(node.title).includes(normalise(seed.label)))) {
    score += 3;
  }

  if (
    seed.scene &&
    sceneNodes.some((node) => normalise(node.title).includes(normalise(seed.scene!)))
  ) {
    score += 2;
  }

  return score;
}

function pickBestGenreSceneSeed(story: StoryBeyondInput): GenreSceneSeedEntry | null {
  const genreNodes = story.nodes.filter((node) => node.type === "genre");
  const sceneNodes = story.nodes.filter((node) => node.type === "scene");

  const ranked = GENRE_SCENE_SEEDS.filter((seed) => seed.id !== DEFAULT_GENRE_SEED_ID)
    .map((seed) => ({ seed, score: scoreGenreSeed(seed, story, genreNodes, sceneNodes) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (best && best.score > 0) return best.seed;
  return null;
}

function buildReason(input: {
  connectionType: BeyondConnectionType;
  sceneLabel?: string;
  personName?: string;
  rootArtistLabel: string;
  edgeLabel?: string;
}): string {
  const { connectionType, sceneLabel, personName, rootArtistLabel, edgeLabel } = input;

  switch (connectionType) {
    case "same_artist":
      return `Another lane from ${rootArtistLabel}`;
    case "featured_artist":
      return personName
        ? `Shared orbit with ${personName}`
        : "A collaborator-led detour";
    case "musicbrainz_related":
      return edgeLabel
        ? `Connected through ${edgeLabel.toLowerCase()}`
        : "A related thread from the same story map";
    case "scene_seed":
      return sceneLabel
        ? `A route through the ${sceneLabel.toLowerCase()} scene`
        : "A heavier route from the same scene";
    case "genre_seed":
      return sceneLabel
        ? `Adjacent picks in ${sceneLabel.toLowerCase()}`
        : "Musically adjacent discovery";
    case "producer_credit":
    case "songwriter_credit":
      return personName
        ? `Connected through ${rootArtistLabel}'s writing world`
        : "Connected through the same creative circle";
    case "fallback":
      return sceneLabel
        ? `Fallback picks from ${sceneLabel.toLowerCase()}`
        : "Curated fallback when live adjacency was thin";
    case "lastfm_similar_artist":
    case "lastfm_tag_seed":
      return "Last.fm taste graph match";
  }
}

function toCandidateKey(title: string, artist: string): string {
  return `${normalise(title)}|${normalise(artist)}`;
}

function trackToCandidate(
  track: SpotifyArtistSearchTrack,
  input: {
    connectionType: BeyondConnectionType;
    matchMethod: BeyondMatchMethod;
    reason: string;
    searchedPerson?: string;
    sceneLabel?: string;
    artistConfidence?: SpotifyArtistMatch["confidence"];
  },
): BeyondCandidate {
  const musicalAdjacencyScore = computeMusicalAdjacencyScore({
    connectionType: input.connectionType,
    matchMethod: input.matchMethod,
    artistConfidence: input.artistConfidence,
  });

  return {
    key: toCandidateKey(track.name, track.artistLabel),
    title: track.name,
    artist: track.artistLabel,
    spotifyUri: track.uri,
    connectionType: input.connectionType,
    source: "spotify_search",
    reason: input.reason,
    confidence: Math.min(0.95, 0.7 + musicalAdjacencyScore * 0.05),
    musicalAdjacencyScore,
    matchMethod: input.matchMethod,
    searchedPerson: input.searchedPerson,
    sceneLabel: input.sceneLabel,
  };
}

function seedToCandidate(
  seed: SeedTrack,
  input: {
    connectionType: "scene_seed" | "genre_seed" | "fallback";
    reason: string;
    sceneLabel?: string;
  },
): BeyondCandidate {
  const musicalAdjacencyScore = computeMusicalAdjacencyScore({
    connectionType: input.connectionType,
    matchMethod: "seed",
  });

  return {
    key: toCandidateKey(seed.title, seed.artist),
    title: seed.title,
    artist: seed.artist,
    connectionType: input.connectionType,
    source: "curated_fallback",
    reason: input.reason,
    confidence: input.connectionType === "fallback" ? 0.55 : 0.72,
    musicalAdjacencyScore,
    matchMethod: "seed",
    sceneLabel: input.sceneLabel,
  };
}

async function collectSameArtistCandidates(
  story: StoryBeyondInput,
  seenUris: Set<string>,
): Promise<BeyondCandidate[]> {
  const candidates: BeyondCandidate[] = [];
  const rootArtistLabel = formatArtists(story.rootTrack);

  for (const artist of story.rootTrack.artists) {
    const results = await searchTracksByArtist(artist.name, 4);

    for (const track of results) {
      if (seenUris.has(track.uri) || track.id === story.rootTrack.id) continue;

      const matchMethod = classifyTrackMatch(artist.name, artist.id, track);
      if (matchMethod === "title_only" || matchMethod === "none") continue;

      seenUris.add(track.uri);
      candidates.push(
        trackToCandidate(track, {
          connectionType: "same_artist",
          matchMethod,
          reason: buildReason({
            connectionType: "same_artist",
            rootArtistLabel,
          }),
          searchedPerson: artist.name,
        }),
      );
    }
  }

  return candidates;
}

async function collectCreditCandidates(
  story: StoryBeyondInput,
  seenUris: Set<string>,
): Promise<BeyondCandidate[]> {
  const candidates: BeyondCandidate[] = [];
  const rootArtistNames = new Set(
    story.rootTrack.artists.map((artist) => normalise(artist.name)),
  );
  const rootArtistLabel = formatArtists(story.rootTrack);

  for (const node of getPeopleNodes(story)) {
    if (node.type !== "producer" && node.type !== "songwriter") continue;
    if (rootArtistNames.has(normalise(node.title))) continue;

    const artistMatch = await searchSpotifyArtist(node.title);
    if (!artistMatch || !qualifiesAsPerformingArtist(artistMatch)) continue;

    const connectionType: BeyondConnectionType =
      node.type === "producer" ? "producer_credit" : "songwriter_credit";

    const results = await searchTracksForSpotifyArtist(artistMatch, 2);

    for (const track of results) {
      if (seenUris.has(track.uri) || track.id === story.rootTrack.id) continue;

      const matchMethod = classifyTrackMatch(node.title, artistMatch.id, track);
      if (matchMethod === "title_only" || matchMethod === "none") continue;

      seenUris.add(track.uri);
      candidates.push(
        trackToCandidate(track, {
          connectionType,
          matchMethod,
          reason: buildReason({
            connectionType,
            personName: node.title,
            rootArtistLabel,
          }),
          searchedPerson: node.title,
          artistConfidence: artistMatch.confidence,
        }),
      );
    }
  }

  return candidates.map((candidate) => ({
    ...candidate,
    source: "musicbrainz_credit" as const,
  }));
}

function isSimilarToRoot(seed: SeedTrack, story: StoryBeyondInput): boolean {
  const rootTitle = normalise(story.rootTrack.title)
    .replace(/\(feat\.[^)]+\)/gi, "")
    .trim();
  const seedTitle = normalise(seed.title);
  if (seedTitle === rootTitle) return true;

  return story.rootTrack.artists.some((artist) =>
    nameMatches(seed.artist, artist.name) && seedTitle === rootTitle,
  );
}

function collectGenreSceneSeedCandidates(story: StoryBeyondInput): BeyondCandidate[] {
  const seed = pickBestGenreSceneSeed(story);
  if (!seed) return [];

  const connectionType: BeyondConnectionType = seed.scene ? "scene_seed" : "genre_seed";
  const rootArtistLabel = formatArtists(story.rootTrack);

  return seed.tracks
    .filter((track) => !isSimilarToRoot(track, story))
    .map((track) =>
      seedToCandidate(track, {
        connectionType,
        sceneLabel: seed.scene ?? seed.label,
        reason: buildReason({
          connectionType,
          sceneLabel: seed.scene ?? seed.label,
          rootArtistLabel,
        }),
      }),
    );
}

function collectFallbackCandidates(story: StoryBeyondInput): BeyondCandidate[] {
  const seed = pickBestGenreSceneSeed(story);
  const label = seed?.scene ?? seed?.label ?? "discovery";

  const pool =
    seed?.tracks ??
    GENRE_SCENE_SEEDS.filter((entry) => entry.id !== DEFAULT_GENRE_SEED_ID).flatMap(
      (entry) => entry.tracks,
    );

  return pool.slice(0, 5).map((track) =>
    seedToCandidate(track, {
      connectionType: "fallback",
      sceneLabel: label,
      reason: buildReason({
        connectionType: "fallback",
        sceneLabel: label,
        rootArtistLabel: formatArtists(story.rootTrack),
      }),
    }),
  );
}

export type BuildBeyondPathResult = {
  candidates: BeyondCandidate[];
  selected: BeyondCandidate[];
  genreSeed: GenreSceneSeedEntry | null;
  rootTaste: TasteProfile | null;
  rootVibe: import("../vibeProfile").VibeProfile | null;
  lastfmEnabled: boolean;
};

export async function buildBeyondPathCandidates(
  story: StoryBeyondInput,
): Promise<BuildBeyondPathResult> {
  const rootUri = `spotify:track:${story.rootTrack.spotifyId ?? story.rootTrack.id}`;
  const seenUris = new Set<string>([rootUri]);
  const genreSeed = pickBestGenreSceneSeed(story);
  const rootArtistName = story.rootTrack.artists[0]?.name ?? formatArtists(story.rootTrack);
  const rootArtistNames = new Set(
    story.rootTrack.artists.map((artist) => normalise(artist.name)),
  );

  const lastfm = await collectLastfmCandidates({
    rootArtistName,
    rootTrackTitle: story.rootTrack.title,
    rootTrackId: story.rootTrack.id,
    rootArtistNames,
    seenUris,
  });

  const allCandidates: BeyondCandidate[] = [...lastfm.candidates];

  if (allCandidates.length < BEYOND_LIMITS.minTracks) {
    allCandidates.push(...collectGenreSceneSeedCandidates(story));
  }

  let selected = selectBeyondCandidates(allCandidates);

  if (selected.length < BEYOND_LIMITS.minTracks) {
    const fallback = collectFallbackCandidates(story);
    const usedKeys = new Set(selected.map((candidate) => candidate.key));
    const extras = fallback.filter((candidate) => !usedKeys.has(candidate.key));
    selected = selectBeyondCandidates([...allCandidates, ...extras]);
  }

  if (selected.length < BEYOND_LIMITS.minTracks) {
    const [creditCandidates, sameArtist] = await Promise.all([
      collectCreditCandidates(story, seenUris),
      collectSameArtistCandidates(story, seenUris),
    ]);
    selected = selectBeyondCandidates([
      ...allCandidates,
      ...creditCandidates,
      ...sameArtist,
    ]);
  }

  return {
    candidates: allCandidates,
    selected: selected.slice(0, BEYOND_LIMITS.maxTracks),
    genreSeed,
    rootTaste: lastfm.rootTaste,
    rootVibe: lastfm.rootVibe,
    lastfmEnabled: lastfm.lastfmEnabled,
  };
}

export function beyondCandidateToPlaylistTrack(candidate: BeyondCandidate) {
  return attachCandidateDebug(
    {
      title: candidate.title,
      artist: candidate.artist,
      reason: candidate.reason,
      confidence: candidate.confidence,
      source: candidate.source,
      spotifyUri: candidate.spotifyUri,
      tasteProfile: candidate.tasteProfile,
      vibeProfile: candidate.vibeProfile,
      vibeDirectionHints: candidate.vibeDirectionHints,
    },
    {
      taste: candidate.tasteProfileFull,
      vibe: candidate.vibeProfileFull,
      tasteCloseness: candidate.tasteCloseness,
      vibeCloseness: candidate.vibeCloseness,
    },
  );
}

export function beyondAvailableDirections(
  rootVibe: import("../vibeProfile").VibeProfile | null,
  rootTaste: TasteProfile | null,
): import("../types").VibeDirectionChip[] | undefined {
  const vibe =
    rootVibe ?? (rootTaste ? deriveVibeProfile(rootTaste, []) : null);
  if (!vibe) return undefined;
  const directions = getAvailableVibeDirections(vibe);
  return directions.length > 0 ? directions : undefined;
}

export { rootTrackLabel, getPeopleNodes, pickBestGenreSceneSeed };
