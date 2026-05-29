import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { MusicStory, PlaylistCandidateTrack } from "../types";
import type {
  FixturePlaylistResult,
  FixtureRecommendationTrack,
  RecommendationFixtureWorld,
  WarmedFixtureFile,
} from "./types";
import { STATIC_RECOMMENDATION_WORLDS } from "./worlds";

const WARMED_FIXTURE_PATH = join(
  /* turbopackIgnore: true */ process.cwd(),
  "data",
  "recommendation-fixtures.json",
);

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

export function isRecommendationFixturesEnabled(): boolean {
  return process.env.NEXT_PUBLIC_USE_RECOMMENDATION_FIXTURES === "true";
}

let warmedCache: WarmedFixtureFile | null | undefined;

async function loadWarmedFixtures(): Promise<WarmedFixtureFile | null> {
  if (warmedCache !== undefined) return warmedCache;
  try {
    const raw = await readFile(WARMED_FIXTURE_PATH, "utf8");
    warmedCache = JSON.parse(raw) as WarmedFixtureFile;
    return warmedCache;
  } catch {
    warmedCache = null;
    return null;
  }
}

export async function getAllFixtureWorlds(): Promise<RecommendationFixtureWorld[]> {
  const warmed = await loadWarmedFixtures();
  if (!warmed?.worlds?.length) return STATIC_RECOMMENDATION_WORLDS;

  const bySlug = new Map<string, RecommendationFixtureWorld>();
  for (const world of STATIC_RECOMMENDATION_WORLDS) {
    bySlug.set(world.slug, world);
  }
  for (const world of warmed.worlds) {
    bySlug.set(world.slug, world);
  }
  return [...bySlug.values()];
}

export async function findFixtureWorld(input: {
  rootTrackId: string;
  rootArtistName: string;
  rootTrackTitle?: string;
}): Promise<RecommendationFixtureWorld | null> {
  const worlds = await getAllFixtureWorlds();
  const artistNorm = normalise(input.rootArtistName);
  const primaryArtist = normalise(input.rootArtistName.split(/, | & /)[0] ?? input.rootArtistName);

  return (
    worlds.find(
      (world) =>
        world.matchSpotifyTrackIds?.includes(input.rootTrackId) ||
        world.matchArtists.some(
          (name) =>
            normalise(name) === artistNorm ||
            normalise(name) === primaryArtist ||
            artistNorm.includes(normalise(name)) ||
            normalise(name).includes(primaryArtist),
        ),
    ) ?? null
  );
}

function fixtureTrackToPlaylistTrack(
  track: FixtureRecommendationTrack,
  index: number,
): PlaylistCandidateTrack {
  const vibeLabels = track.vibeLabels ?? [];
  return {
    title: track.title,
    artist: track.artist,
    reason: track.reason,
    confidence: 0.72 + (index % 5) * 0.02,
    source: "lastfm_similar_artist",
    spotifyUri: track.spotifyUri ?? undefined,
    spotifyId: track.spotifyId ?? undefined,
    previewUrl: track.previewUrl ?? null,
    artworkUrl: track.artworkUrl ?? null,
    directionLabel: vibeLabels[0],
    vibeProfile:
      vibeLabels.length > 0
        ? {
            labels: vibeLabels,
            topDimensions: vibeLabels.slice(0, 3).map((label, i) => ({
              dimension: label,
              score: 0.9 - i * 0.1,
              tier: "high",
              label,
            })),
            label: vibeLabels.join(" · "),
            sentence: track.reason,
          }
        : undefined,
  };
}

export function fixtureWorldToPlaylist(
  world: RecommendationFixtureWorld,
  rootTrackId: string,
): FixturePlaylistResult {
  const tracks = world.tracks.map(fixtureTrackToPlaylistTrack);
  const playableCount = tracks.filter((t) => t.spotifyUri).length;

  return {
    fixtureSlug: world.slug,
    playlists: [
      {
        id: `fixture-${world.slug}-${rootTrackId}`,
        name: `Because you like ${world.rootTrack.title}`,
        description: "A mini playlist built from nearby artists, tags and scenes.",
        vibe: "Discovery",
        trackCount: tracks.length,
        seedTrackId: rootTrackId,
        tracks,
        fallbackUsed: false,
        demoFallback: false,
      },
    ],
    discovery: {
      status: "ready",
      message: playableCount === 0 ? "Fixture tracks have no Spotify URIs — save is disabled." : "",
      spotifyRateLimited: false,
      realCandidateCount: tracks.length,
      demoFallbackActive: false,
      similarArtists: world.similarArtists,
      servedFromCache: false,
    },
  };
}

export async function generateFixturePlaylist(input: {
  rootTrack: MusicStory["rootTrack"];
}): Promise<FixturePlaylistResult | null> {
  const rootArtistName = input.rootTrack.artists[0]?.name ?? input.rootTrack.title;
  const world = await findFixtureWorld({
    rootTrackId: input.rootTrack.id,
    rootArtistName,
    rootTrackTitle: input.rootTrack.title,
  });

  if (!world) return null;
  return fixtureWorldToPlaylist(world, input.rootTrack.id);
}

export async function writeWarmedFixtures(file: WarmedFixtureFile): Promise<void> {
  const dir = join(/* turbopackIgnore: true */ process.cwd(), "data");
  await mkdir(dir, { recursive: true });
  await writeFile(WARMED_FIXTURE_PATH, JSON.stringify(file, null, 2), "utf8");
  warmedCache = file;
}

export function getWarmedFixturePath(): string {
  return WARMED_FIXTURE_PATH;
}

export { STATIC_RECOMMENDATION_WORLDS };
