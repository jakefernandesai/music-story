import { loadEnvConfig } from "@next/env";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { STATIC_RECOMMENDATION_WORLDS } from "../src/lib/fixtures/worlds";
import {
  getWarmedFixturePath,
  writeWarmedFixtures,
} from "../src/lib/fixtures/recommendation-fixtures";
import type {
  FixtureRecommendationTrack,
  RecommendationFixtureWorld,
  WarmedFixtureFile,
} from "../src/lib/fixtures/types";
import { generatePlaylistWithDiscovery } from "../src/lib/mini-playlist";
import { getStoryForUrl } from "../src/lib/get-story";

loadEnvConfig(process.cwd());

/** Ensure live generation runs — not fixture mode. */
process.env.NEXT_PUBLIC_USE_RECOMMENDATION_FIXTURES = "false";

function toFixtureTrack(
  track: {
    title: string;
    artist: string;
    reason: string;
    spotifyUri?: string;
    spotifyId?: string;
    previewUrl?: string | null;
    artworkUrl?: string | null;
    vibeProfile?: { labels?: string[] };
  },
  staticTrack?: FixtureRecommendationTrack,
): FixtureRecommendationTrack {
  return {
    title: track.title,
    artist: track.artist,
    reason: track.reason,
    tags: staticTrack?.tags,
    vibeLabels: track.vibeProfile?.labels ?? staticTrack?.vibeLabels,
    spotifyUri: track.spotifyUri ?? null,
    spotifyId: track.spotifyId ?? null,
    previewUrl: track.previewUrl ?? null,
    artworkUrl: track.artworkUrl ?? staticTrack?.artworkUrl ?? null,
  };
}

async function warmWorld(staticWorld: RecommendationFixtureWorld): Promise<RecommendationFixtureWorld> {
  console.log(`\nWarming: ${staticWorld.label} (${staticWorld.rootTrack.spotifyUrl})`);

  const story = await getStoryForUrl(staticWorld.rootTrack.spotifyUrl);
  const { playlists, discovery } = await generatePlaylistWithDiscovery({
    rootTrack: story.rootTrack,
    nodes: story.nodes,
    edges: story.edges,
    vibeSignature: story.vibeSignature,
    connectedTracks: story.connectedTracks,
  });

  const playlist = playlists[0];
  if (!playlist || playlist.tracks.length === 0) {
    console.log(`  ⚠ No tracks generated (status: ${discovery.status}) — keeping static fixture`);
    return staticWorld;
  }

  const staticByKey = new Map(
    staticWorld.tracks.map((t) => [`${t.title.toLowerCase()}|${t.artist.toLowerCase()}`, t]),
  );

  const tracks = playlist.tracks.map((track) => {
    const key = `${track.title.toLowerCase()}|${track.artist.toLowerCase()}`;
    return toFixtureTrack(track, staticByKey.get(key));
  });

  const withUri = tracks.filter((t) => t.spotifyUri).length;
  const withPreview = tracks.filter((t) => t.previewUrl).length;

  console.log(`  ✓ ${tracks.length} tracks, ${withUri} URIs, ${withPreview} previews`);

  return {
    ...staticWorld,
    tracks,
    similarArtists: discovery.similarArtists ?? staticWorld.similarArtists,
  };
}

async function main() {
  console.log("Warm recommendation fixtures");
  console.log(`Output: ${getWarmedFixturePath()}\n`);

  const worlds: RecommendationFixtureWorld[] = [];

  for (const staticWorld of STATIC_RECOMMENDATION_WORLDS) {
    try {
      worlds.push(await warmWorld(staticWorld));
    } catch (error) {
      console.error(`  ✗ Failed: ${error instanceof Error ? error.message : error}`);
      worlds.push(staticWorld);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  const payload: WarmedFixtureFile = {
    version: 1,
    updatedAt: new Date().toISOString(),
    worlds,
  };

  await writeWarmedFixtures(payload);

  const summaryPath = join(process.cwd(), "data", "recommendation-fixtures.summary.json");
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(
    summaryPath,
    JSON.stringify(
      {
        updatedAt: payload.updatedAt,
        worlds: worlds.map((w) => ({
          slug: w.slug,
          trackCount: w.tracks.length,
          uriCount: w.tracks.filter((t) => t.spotifyUri).length,
          previewCount: w.tracks.filter((t) => t.previewUrl).length,
        })),
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log("\nDone. Enable offline dev with:");
  console.log("  NEXT_PUBLIC_USE_RECOMMENDATION_FIXTURES=true");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
