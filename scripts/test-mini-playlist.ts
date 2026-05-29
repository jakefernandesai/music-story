import { loadEnvConfig } from "@next/env";
import { generateMiniPlaylist } from "../src/lib/mini-playlist";
import { getStoryForUrl } from "../src/lib/get-story";

loadEnvConfig(process.cwd());

const TEST_TRACKS = [
  { artist: "Overmono", url: "https://open.spotify.com/track/1ZnghCVtXCrtmKJH32z4UK" },
  { artist: "Knocked Loose", url: "https://open.spotify.com/track/6PXYOVPBzO3xojFhQAvmde" },
  { artist: "Ninajirachi", url: "https://open.spotify.com/track/5ZbztTcvj6QWWbeYsL4GTa" },
  { artist: "Burial", url: "https://open.spotify.com/track/5kadOt1O3LrIV46dns9v7u" },
  { artist: "Metallica", url: "https://open.spotify.com/track/2MuWTIM3b0YEAskbeeFE1i" },
] as const;

async function main() {
  console.log("Mini-playlist generation test\n");

  for (const test of TEST_TRACKS) {
    console.log("=".repeat(56));
    console.log(`ARTIST: ${test.artist}`);
    console.log("=".repeat(56));

    try {
      const story = await getStoryForUrl(test.url);
      const playlist = await generateMiniPlaylist({
        rootTrack: story.rootTrack,
        nodes: story.nodes,
        edges: story.edges,
        vibeSignature: story.vibeSignature,
      });

      const withPreview = playlist.tracks.filter((t) => t.previewUrl).length;

      console.log(`Songs generated: ${playlist.tracks.length}`);
      console.log(`With Spotify preview: ${withPreview}`);
      console.log(`Fallback used: ${playlist.fallbackUsed ? "yes" : "no"}`);
      console.log(
        `Path split: familiar=${playlist.pathCounts?.familiar ?? 0} adjacent=${playlist.pathCounts?.adjacent ?? 0} stranger=${playlist.pathCounts?.stranger ?? 0}`,
      );

      playlist.tracks.slice(0, 5).forEach((track, i) => {
        console.log(
          `  ${i + 1}. ${track.title} — ${track.artist}${track.directionLabel ? ` [${track.directionLabel}]` : ""}${track.previewUrl ? " ♪" : ""}`,
        );
      });
      if (playlist.tracks.length > 5) {
        console.log(`  … and ${playlist.tracks.length - 5} more`);
      }
    } catch (error) {
      console.log(`ERROR: ${error instanceof Error ? error.message : error}`);
    }

    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
