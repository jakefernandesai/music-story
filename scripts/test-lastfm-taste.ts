import { loadEnvConfig } from "@next/env";
import {
  getLastfmArtistTags,
  getLastfmSimilarArtists,
  isLastfmEnabled,
} from "../src/lib/lastfm";
import { searchTracksByArtist } from "../src/lib/spotify";
import {
  assertTasteExpectations,
  compareTasteProfiles,
  formatTasteProfileBlock,
  getDirectionalLabel,
  summariseTasteProfile,
  TASTE_EXPECTATIONS,
  tagsToTasteProfile,
} from "../src/lib/tasteProfile";
import {
  assertVibeExpectations,
  deriveVibeProfile,
  formatVibeProfileBlock,
  getTopVibeLabels,
  tagsToWeightedTags,
  VIBE_EXPECTATIONS,
} from "../src/lib/vibeProfile";

loadEnvConfig(process.cwd());

const TEST_ARTISTS = [
  "Overmono",
  "Burial",
  "Bicep",
  "Fred again..",
  "deadmau5",
  "Metallica",
  "Dua Lipa",
  "Bad Omens",
  "Knocked Loose",
  "Sleep Token",
  "Ninajirachi",
  "M83",
  "SOPHIE",
] as const;

async function inspectArtist(artistName: string) {
  console.log("\n" + "=".repeat(60));
  console.log(`ARTIST: ${artistName}`);
  console.log("=".repeat(60));

  const tags = await getLastfmArtistTags(artistName);
  const similar = await getLastfmSimilarArtists(artistName, 8);
  const weightedTags = tagsToWeightedTags(tags);
  const taste = tagsToTasteProfile(tags);
  const vibe = deriveVibeProfile(taste, weightedTags);
  const tasteSummary = summariseTasteProfile(taste);
  const vibeLabels = getTopVibeLabels(vibe);

  console.log("\nTop Last.fm tags:");
  if (tags.length === 0) {
    console.log("  (none — weak or missing Last.fm data)");
  } else {
    tags.slice(0, 8).forEach((tag) => {
      console.log(`  • ${tag.name} (count ${tag.count}, weight ${tag.weight.toFixed(2)})`);
    });
  }

  console.log("\n1. TasteProfile (0–100):");
  console.log(`  Summary: ${tasteSummary.label}`);
  console.log("  dimension        score  tier");
  console.log("  " + "-".repeat(36));
  formatTasteProfileBlock(taste).forEach((line) => {
    console.log(`  ${line}`);
  });

  console.log("\n2. VibeProfile (0–100):");
  console.log("  dimension        score  tier");
  console.log("  " + "-".repeat(36));
  formatVibeProfileBlock(vibe).forEach((line) => {
    console.log(`  ${line}`);
  });

  console.log("\n3. Top human-facing labels:");
  if (vibeLabels.length === 0) {
    console.log("  (none above threshold)");
  } else {
    vibeLabels.forEach((label, index) => {
      console.log(`  ${index + 1}. ${label}`);
    });
  }

  const tasteExpectations = assertTasteExpectations(artistName, taste, TASTE_EXPECTATIONS);
  const vibeExpectations = assertVibeExpectations(artistName, vibe, VIBE_EXPECTATIONS);

  if (
    tasteExpectations.passed.length > 0 ||
    tasteExpectations.failed.length > 0 ||
    vibeExpectations.passed.length > 0 ||
    vibeExpectations.failed.length > 0
  ) {
    console.log("\nExpectations:");
    tasteExpectations.passed.forEach((line) => console.log(`  ✓ [taste] ${line}`));
    tasteExpectations.failed.forEach((line) => console.log(`  ✗ [taste] ${line}`));
    vibeExpectations.passed.forEach((line) => console.log(`  ✓ [vibe] ${line}`));
    vibeExpectations.failed.forEach((line) => console.log(`  ✗ [vibe] ${line}`));
  }

  console.log("\nSimilar artists (Last.fm):");
  if (similar.length === 0) {
    console.log("  (none)");
  } else {
    similar.slice(0, 6).forEach((entry) => {
      console.log(`  • ${entry.name} (match ${entry.match.toFixed(2)})`);
    });
  }

  const sampleSimilar = similar[0];
  if (sampleSimilar) {
    const similarTags = await getLastfmArtistTags(sampleSimilar.name);
    const similarTaste = tagsToTasteProfile(similarTags);
    const closeness = compareTasteProfiles(similarTaste, taste);
    const direction = getDirectionalLabel(similarTaste, taste);

    console.log(`\nTaste vs top similar (${sampleSimilar.name}):`);
    console.log(`  closeness: ${(closeness * 100).toFixed(0)}%`);
    console.log(`  direction: ${direction}`);

    const tracks = await searchTracksByArtist(sampleSimilar.name, 2);
    console.log("\nSample Spotify candidates:");
    if (tracks.length === 0) {
      console.log("  (no Spotify tracks found)");
    } else {
      tracks.forEach((track) => {
        console.log(`  • ${track.name} — ${track.artistLabel}`);
      });
    }
  }
}

async function main() {
  console.log(`Last.fm enabled: ${isLastfmEnabled() ? "yes" : "no (set LASTFM_API_KEY)"}`);

  if (!isLastfmEnabled()) {
    console.error("\nLASTFM_API_KEY is required to run this script.");
    process.exit(1);
  }

  const allFailures: string[] = [];

  for (const artist of TEST_ARTISTS) {
    await inspectArtist(artist);
    const tags = await getLastfmArtistTags(artist);
    const weightedTags = tagsToWeightedTags(tags);
    const taste = tagsToTasteProfile(tags);
    const vibe = deriveVibeProfile(taste, weightedTags);

    const tasteFailed = assertTasteExpectations(artist, taste, TASTE_EXPECTATIONS).failed;
    const vibeFailed = assertVibeExpectations(artist, vibe, VIBE_EXPECTATIONS).failed;

    tasteFailed.forEach((line) => allFailures.push(`${artist} [taste]: ${line}`));
    vibeFailed.forEach((line) => allFailures.push(`${artist} [vibe]: ${line}`));
  }

  console.log("\n" + "=".repeat(60));
  console.log("EXPECTATION SUMMARY");
  console.log("=".repeat(60));

  if (allFailures.length === 0) {
    console.log("All taste and vibe expectations passed.");
  } else {
    console.log(`${allFailures.length} expectation(s) failed:`);
    allFailures.forEach((line) => console.log(`  ✗ ${line}`));
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
