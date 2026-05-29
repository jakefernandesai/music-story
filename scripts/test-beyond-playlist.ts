import { loadEnvConfig } from "@next/env";
import {
  buildCandidatePool,
  generatePlaylistWithDiscovery,
  PLAYLIST_MIN,
  PLAYLIST_TARGET,
} from "../src/lib/mini-playlist";
import {
  getAllowedFamilies,
  getMusicFamily,
  type MusicFamily,
} from "../src/lib/music-family";
import { getLastfmArtistTags } from "../src/lib/lastfm";
import { getStoryForUrl } from "../src/lib/get-story";
import { wasSpotifyRateLimitedInDiagnostics } from "../src/lib/spotify-artist-search";
import { tagsToTasteProfile } from "../src/lib/tasteProfile";

loadEnvConfig(process.cwd());

type TestCase = {
  artist: string;
  url: string;
};

const TEST_CASES: TestCase[] = [
  { artist: "Ninajirachi", url: "https://open.spotify.com/track/5ZbztTcvj6QWWbeYsL4GTa" },
  { artist: "Overmono", url: "https://open.spotify.com/track/1ZnghCVtXCrtmKJH32z4UK" },
  { artist: "Burial", url: "https://open.spotify.com/track/5kadOt1O3LrIV46dns9v7u" },
  { artist: "Knocked Loose", url: "https://open.spotify.com/track/6PXYOVPBzO3xojFhQAvmde" },
  { artist: "Dua Lipa", url: "https://open.spotify.com/track/5nujrmhLynf4yMoMtj8AQF" },
];

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function primaryArtist(artist: string): string {
  return artist.split(/, | & /)[0]?.trim() ?? artist;
}

function countRootArtistTracks(
  tracks: Array<{ artist: string }>,
  rootArtistNames: Set<string>,
): number {
  return tracks.filter((track) =>
    rootArtistNames.has(normalise(primaryArtist(track.artist))),
  ).length;
}

function runUnitTests(): string[] {
  const failures: string[] = [];

  const electronicAllowed = getAllowedFamilies("electronic");
  if (electronicAllowed.includes("metal") || electronicAllowed.includes("rock")) {
    failures.push("electronic must not allow metal/rock in close adjacency");
  }

  const burialFamily = getMusicFamily(null, [
    { name: "uk garage", weight: 90 },
    { name: "ambient", weight: 70 },
  ]);
  if (!["electronic", "ambient"].includes(burialFamily)) {
    failures.push(`Burial family expected electronic/ambient, got ${burialFamily}`);
  }

  return failures;
}

async function runPlaylistTest(test: TestCase): Promise<string[]> {
  const failures: string[] = [];

  console.log("=".repeat(60));
  console.log(`PLAYLIST: ${test.artist}`);
  console.log("=".repeat(60));

  try {
    const story = await getStoryForUrl(test.url);
    const rootArtistNames = new Set(
      story.rootTrack.artists.map((artist) => normalise(artist.name)),
    );

    const poolResult = await buildCandidatePool({
      rootTrack: story.rootTrack,
      nodes: story.nodes,
      edges: story.edges,
      vibeSignature: story.vibeSignature,
      connectedTracks: story.connectedTracks,
    });

    const rateLimited = wasSpotifyRateLimitedInDiagnostics(poolResult.spotifyDiagnostics);

    const { playlists, discovery } = await generatePlaylistWithDiscovery({
      rootTrack: story.rootTrack,
      nodes: story.nodes,
      edges: story.edges,
      vibeSignature: story.vibeSignature,
      connectedTracks: story.connectedTracks,
    });

    const playlist = playlists[0];
    const tracks = playlist?.tracks ?? [];
    const uniqueArtists = new Set(tracks.map((t) => normalise(primaryArtist(t.artist))));
    const rootArtistCount = countRootArtistTracks(tracks, rootArtistNames);
    const previewCount = tracks.filter((t) => t.previewUrl).length;
    const playableCount = tracks.filter((t) => t.spotifyUri).length;
    const fallbackUsed = playlist?.fallbackUsed ?? false;

    const rootTags = await getLastfmArtistTags(test.artist);
    const rootFamily: MusicFamily = getMusicFamily(
      rootTags.length > 0 ? tagsToTasteProfile(rootTags) : null,
      rootTags,
    );

    console.log(`  root family:           ${rootFamily}`);
    console.log(`  pool candidates:       ${poolResult.pool.length}`);
    console.log(`  playlist tracks:       ${tracks.length} (target ${PLAYLIST_TARGET}, min ${PLAYLIST_MIN})`);
    console.log(`  unique artists:        ${uniqueArtists.size}`);
    console.log(`  root artist tracks:    ${rootArtistCount} (max 2)`);
    console.log(`  playable (Spotify URI): ${playableCount}`);
    console.log(`  preview_url count:     ${previewCount}`);
    console.log(`  fallback used:         ${fallbackUsed ? "yes" : "no"}`);
    console.log(`  discovery status:      ${discovery.status}`);

    if (discovery.status !== "ready" && tracks.length === 0) {
      console.log(`  degraded:              ${discovery.message}`);
      if (rateLimited) {
        console.log("  (rate limited — skipping track count assertions)");
        return failures;
      }
    }

    if (!rateLimited && tracks.length > 0) {
      if (tracks.length < PLAYLIST_MIN) {
        failures.push(`${test.artist}: playlist ${tracks.length} < min ${PLAYLIST_MIN}`);
      }
      if (rootArtistCount > 2) {
        failures.push(`${test.artist}: ${rootArtistCount} root artist tracks (max 2)`);
      }
      if (playableCount < tracks.length) {
        failures.push(`${test.artist}: ${tracks.length - playableCount} tracks missing Spotify URI`);
      }
      if (fallbackUsed && process.env.NEXT_PUBLIC_DEMO_FALLBACK !== "true") {
        failures.push(`${test.artist}: fallback used outside demo mode`);
      }
    }

    if (failures.filter((f) => f.startsWith(test.artist)).length === 0) {
      console.log("  ✓ checks passed");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push(`${test.artist}: ${message}`);
    console.log(`  ERROR: ${message}`);
  }

  console.log();
  await new Promise((resolve) => setTimeout(resolve, 2000));
  return failures;
}

async function main() {
  console.log("=== You might also like — playlist tests ===\n");

  const unitFailures = runUnitTests();
  if (unitFailures.length === 0) {
    console.log("Unit checks passed.\n");
  } else {
    unitFailures.forEach((f) => console.log(`  ✗ ${f}`));
    console.log();
  }

  const integrationFailures: string[] = [];
  for (const test of TEST_CASES) {
    integrationFailures.push(...(await runPlaylistTest(test)));
  }

  const allFailures = [...unitFailures, ...integrationFailures];
  if (allFailures.length > 0) {
    console.error(`\n${allFailures.length} failure(s):`);
    allFailures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
  }

  console.log("All playlist tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
