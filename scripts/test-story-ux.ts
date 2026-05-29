import { loadEnvConfig } from "@next/env";
import { countPeople } from "../src/lib/story-context-utils";
import { releaseWorldIsRich } from "../src/lib/story-context-utils";
import { getStoryForUrl } from "../src/lib/get-story";

loadEnvConfig(process.cwd());

const TEST_TRACKS = [
  { artist: "Overmono", url: "https://open.spotify.com/track/1ZnghCVtXCrtmKJH32z4UK" },
  { artist: "Ninajirachi", url: "https://open.spotify.com/track/5ZbztTcvj6QWWbeYsL4GTa" },
  { artist: "Knocked Loose", url: "https://open.spotify.com/track/6PXYOVPBzO3xojFhQAvmde" },
  { artist: "Burial", url: "https://open.spotify.com/track/5kadOt1O3LrIV46dns9v7u" },
  { artist: "Metallica", url: "https://open.spotify.com/track/2MuWTIM3b0YEAskbeeFE1i" },
] as const;

async function main() {
  console.log("Story UX test report\n");

  for (const test of TEST_TRACKS) {
    console.log("=".repeat(56));
    console.log(`ARTIST: ${test.artist}`);
    console.log("=".repeat(56));

    try {
      const story = await getStoryForUrl(test.url);
      const people = story.people;
      const peopleTotal = countPeople(people);

      console.log("\nPeople data:");
      console.log(`  Total: ${peopleTotal}`);
      console.log(`  Producers: ${people.producers.length}`);
      console.log(`  Writers: ${people.writers.length}`);
      console.log(`  Performers: ${people.performers.length}`);
      console.log(`  Remixers: ${people.remixers.length}`);
      console.log(`  Engineers: ${people.engineers.length}`);

      console.log("\nRelease world:");
      if (story.releaseWorld && releaseWorldIsRich(story.releaseWorld)) {
        const rw = story.releaseWorld;
        console.log(`  Album: ${rw.albumTitle}`);
        console.log(`  Label: ${rw.label ?? "—"}`);
        console.log(`  Year: ${rw.releaseYear}`);
        console.log(`  Country: ${rw.country ?? "—"}`);
        console.log(`  Format: ${rw.format ?? "—"}`);
      } else if (story.releaseWorld) {
        console.log("  Merged into track (minimal extra metadata)");
      } else {
        console.log("  None");
      }

      console.log(`\nConnected tracks: ${story.connectedTracks.length}`);
      const connectedPreviews = story.connectedTracks.filter((t) => t.previewUrl).length;
      console.log(`  With preview: ${connectedPreviews}`);

      console.log("\nRabbit holes:");
      let totalPreviews = 0;
      for (const hole of story.playlistCandidates) {
        const previews = hole.tracks.filter((t) => t.previewUrl).length;
        totalPreviews += previews;
        console.log(
          `  ${hole.pathRoute ?? hole.name}: ${hole.trackCount} tracks (${previews} previews)${hole.fallbackUsed ? " [fallback]" : ""}`,
        );
      }
      console.log(`\nTotal preview_url across rabbit holes: ${totalPreviews}`);
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
