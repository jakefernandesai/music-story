import { loadEnvConfig } from "@next/env";
import {
  getLastfmArtistTags,
  getLastfmTrackTags,
  isLastfmEnabled,
  type LastfmTag,
} from "../src/lib/lastfm";
import {
  classifyTagCoverage,
  enrichRootTagsFromFetched,
  meaningfulTags,
  type TagCoverageQuality,
} from "../src/lib/tag-enrichment";
import {
  filterStrongTags,
  getMusicFamily,
} from "../src/lib/music-family";
import {
  compareTasteProfiles,
  tagsToTasteProfile,
} from "../src/lib/tasteProfile";

loadEnvConfig(process.cwd());

const TEST_TRACKS = [
  { artist: "Overmono", title: "Good Lies" },
  { artist: "Burial", title: "Archangel" },
  { artist: "Ninajirachi", title: "Ninacamina" },
  { artist: "Fred again..", title: "Delilah (pull me out of this)" },
  { artist: "Bicep", title: "Glue" },
  { artist: "Knocked Loose", title: "Suffocate" },
  { artist: "Sleep Token", title: "Euclid" },
  { artist: "Bad Omens", title: "ARTificial Suicide" },
  { artist: "Metallica", title: "Master of Puppets" },
  { artist: "Dua Lipa", title: "Levitating" },
  { artist: "Charli xcx", title: "360" },
  { artist: "SOPHIE", title: "Immaterial" },
] as const;

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function tagOverlapPercent(trackTags: LastfmTag[], artistTags: LastfmTag[]): number {
  const trackSet = new Set(meaningfulTags(trackTags).map((tag) => normalise(tag.name)));
  const artistSet = new Set(meaningfulTags(artistTags).map((tag) => normalise(tag.name)));
  if (trackSet.size === 0) return 0;

  let overlap = 0;
  for (const tag of trackSet) {
    if (artistSet.has(tag)) overlap += 1;
  }
  return Math.round((overlap / trackSet.size) * 100);
}

function signalScore(tags: LastfmTag[]): number {
  const meaningful = meaningfulTags(tags);
  if (meaningful.length === 0) return 0;

  const topWeight = meaningful.slice(0, 5).reduce((sum, tag) => sum + tag.weight, 0);
  const countBonus = Math.min(meaningful.length, 8) * 0.08;
  return topWeight + countBonus;
}

function formatTopTags(tags: LastfmTag[], limit = 8): string {
  if (tags.length === 0) return "(none)";
  return tags
    .slice(0, limit)
    .map((tag) => `${tag.name} (${tag.count})`)
    .join(", ");
}

function uniqueTrackTags(trackTags: LastfmTag[], artistTags: LastfmTag[]): string[] {
  const artistSet = new Set(meaningfulTags(artistTags).map((tag) => normalise(tag.name)));
  return meaningfulTags(trackTags)
    .map((tag) => tag.name)
    .filter((name) => !artistSet.has(normalise(name)));
}

function wouldMateriallyChangeRecommendations(input: {
  trackTags: LastfmTag[];
  artistTags: LastfmTag[];
}): boolean {
  const { trackTags, artistTags } = input;
  const trackMeaningful = meaningfulTags(trackTags);
  if (trackMeaningful.length === 0) return false;

  const artistFamily = getMusicFamily(tagsToTasteProfile(artistTags), artistTags);
  const trackFamily = getMusicFamily(tagsToTasteProfile(trackTags), trackTags);
  if (trackFamily !== artistFamily && trackFamily !== "unknown") return true;

  const artistTaste = tagsToTasteProfile(artistTags);
  const trackTaste = tagsToTasteProfile(trackTags);
  const tasteGap = 1 - compareTasteProfiles(trackTaste, artistTaste);
  if (tasteGap >= 0.18) return true;

  const uniqueStrong = filterStrongTags(
    uniqueTrackTags(trackTags, artistTags).map((name) => ({ name })),
  );
  if (uniqueStrong.length >= 2) return true;

  const trackSignal = signalScore(trackTags);
  const artistSignal = signalScore(artistTags);
  return trackSignal > artistSignal * 1.25 && trackMeaningful.length >= 3;
}

type TrackReport = {
  artist: string;
  title: string;
  trackTagCount: number;
  trackQuality: TagCoverageQuality;
  overlapPercent: number;
  trackSignal: number;
  artistSignal: number;
  strongerThanArtist: boolean;
  usableTrackTags: boolean;
  wouldChangeRecs: boolean;
};

async function analyseTrack(
  artist: string,
  title: string,
): Promise<TrackReport> {
  const [trackTags, artistTags] = await Promise.all([
    getLastfmTrackTags(artist, title),
    getLastfmArtistTags(artist),
  ]);

  const trackQuality = classifyTagCoverage(trackTags);
  const overlapPercent = tagOverlapPercent(trackTags, artistTags);
  const trackSignal = signalScore(trackTags);
  const artistSignal = signalScore(artistTags);
  const unique = uniqueTrackTags(trackTags, artistTags);

  const report: TrackReport = {
    artist,
    title,
    trackTagCount: trackTags.length,
    trackQuality,
    overlapPercent,
    trackSignal,
    artistSignal,
    strongerThanArtist: trackSignal > artistSignal * 1.05,
    usableTrackTags: meaningfulTags(trackTags).length > 0,
    wouldChangeRecs: wouldMateriallyChangeRecommendations({ trackTags, artistTags }),
  };

  const enrichment = await enrichRootTagsFromFetched({
    artistName: artist,
    trackTitle: title,
    trackTags,
    artistTags,
  });

  console.log("\n" + "=".repeat(64));
  console.log(`${artist} — ${title}`);
  console.log("=".repeat(64));
  console.log(`Track tag count:     ${trackTags.length}`);
  console.log(`Coverage quality:    ${trackQuality}`);
  console.log(`Blend ratio:         ${Math.round(enrichment.blendRatio.track * 100)}% track / ${Math.round(enrichment.blendRatio.artist * 100)}% artist`);
  console.log(`Top track tags:      ${formatTopTags(trackTags)}`);
  console.log(`Top artist tags:     ${formatTopTags(artistTags)}`);
  console.log(`Top blended tags:    ${formatTopTags(enrichment.tags)}`);
  console.log(`Overlap:             ${overlapPercent}%`);
  console.log(`Unique track tags:   ${unique.length > 0 ? unique.slice(0, 6).join(", ") : "(none)"}`);
  console.log(`Track signal:        ${trackSignal.toFixed(2)}`);
  console.log(`Artist signal:       ${artistSignal.toFixed(2)}`);
  console.log(`Stronger than artist:${report.strongerThanArtist ? " yes" : " no"}`);
  console.log(`Would change recs:   ${report.wouldChangeRecs ? " yes" : " no"}`);

  if (report.usableTrackTags) {
    const artistFamily = getMusicFamily(tagsToTasteProfile(artistTags), artistTags);
    if (enrichment.musicFamily !== artistFamily) {
      console.log(`Family shift:        ${artistFamily} → ${enrichment.musicFamily}`);
    }
  }

  return report;
}

function finalRecommendation(reports: TrackReport[]): "A" | "B" | "C" {
  const total = reports.length;
  const usable = reports.filter((r) => r.usableTrackTags).length;
  const material = reports.filter((r) => r.wouldChangeRecs).length;
  const strongOrMedium = reports.filter(
    (r) => r.trackQuality === "strong" || r.trackQuality === "medium",
  ).length;

  const usableRatio = usable / total;
  const materialRatio = material / total;
  const qualityRatio = strongOrMedium / total;

  if (qualityRatio >= 0.6 && materialRatio >= 0.35) return "A";
  if (usableRatio >= 0.45 || materialRatio >= 0.2) return "B";
  return "C";
}

function recommendationLabel(choice: "A" | "B" | "C"): string {
  switch (choice) {
    case "A":
      return "A) Track tags are worth integrating";
    case "B":
      return "B) Track tags should only be used when available";
    case "C":
      return "C) Artist tags are sufficient for V1";
  }
}

type BlendRegressionCase = {
  artist: string;
  title: string;
  assert: (enrichment: Awaited<ReturnType<typeof enrichRootTagsFromFetched>>) => string[];
};

const BLEND_REGRESSION: BlendRegressionCase[] = [
  {
    artist: "Metallica",
    title: "Master of Puppets",
    assert: (e) => {
      const failures: string[] = [];
      if (e.coverage !== "strong") failures.push(`expected strong coverage, got ${e.coverage}`);
      if (e.blendRatio.track < 0.69) failures.push("expected ~70% track blend");
      const top = e.tags.slice(0, 5).map((t) => t.name);
      if (!top.some((t) => t.includes("thrash"))) {
        failures.push(`expected thrash in top blended tags, got: ${top.join(", ")}`);
      }
      return failures;
    },
  },
  {
    artist: "Charli xcx",
    title: "360",
    assert: (e) => {
      const failures: string[] = [];
      if (e.coverage !== "strong") failures.push(`expected strong coverage, got ${e.coverage}`);
      const top = e.tags.slice(0, 6).map((t) => t.name);
      if (!top.some((t) => ["brat", "hyperpop", "bubblegum bass", "electropop"].includes(t))) {
        failures.push(`expected brat/hyperpop signal, got: ${top.join(", ")}`);
      }
      if (e.musicFamily === "pop") {
        failures.push(`expected electronic/hyperpop family, got pop`);
      }
      return failures;
    },
  },
  {
    artist: "Bicep",
    title: "Glue",
    assert: (e) => {
      const failures: string[] = [];
      if (e.coverage !== "strong") failures.push(`expected strong coverage, got ${e.coverage}`);
      const top = e.tags.slice(0, 6).map((t) => t.name);
      if (!top.some((t) => ["breakbeat", "breakbeats", "jungle", "rave", "idm"].includes(t))) {
        failures.push(`expected breakbeat/jungle/rave signal, got: ${top.join(", ")}`);
      }
      return failures;
    },
  },
  {
    artist: "Overmono",
    title: "Good Lies",
    assert: (e) => {
      const failures: string[] = [];
      if (e.coverage !== "none") failures.push(`expected none coverage fallback, got ${e.coverage}`);
      if (e.blendRatio.track !== 0) failures.push("expected 0% track blend (artist-only fallback)");
      return failures;
    },
  },
  {
    artist: "Ninajirachi",
    title: "Ninacamina",
    assert: (e) => {
      const failures: string[] = [];
      if (e.coverage !== "none") failures.push(`expected none coverage fallback, got ${e.coverage}`);
      if (e.blendRatio.track !== 0) failures.push("expected 0% track blend (artist-only fallback)");
      return failures;
    },
  },
];

async function runBlendRegressionTests(): Promise<string[]> {
  const failures: string[] = [];

  console.log("\n" + "=".repeat(64));
  console.log("BLEND REGRESSION TESTS");
  console.log("=".repeat(64));

  for (const test of BLEND_REGRESSION) {
    const [trackTags, artistTags] = await Promise.all([
      getLastfmTrackTags(test.artist, test.title),
      getLastfmArtistTags(test.artist),
    ]);
    const enrichment = await enrichRootTagsFromFetched({
      artistName: test.artist,
      trackTitle: test.title,
      trackTags,
      artistTags,
    });

    const caseFailures = test.assert(enrichment);
    if (caseFailures.length === 0) {
      console.log(`✓ ${test.artist} — ${test.title}`);
    } else {
      console.log(`✗ ${test.artist} — ${test.title}`);
      caseFailures.forEach((f) => {
        console.log(`    ${f}`);
        failures.push(`${test.artist}: ${f}`);
      });
    }
  }

  return failures;
}

async function main() {
  if (!isLastfmEnabled()) {
    console.error("LASTFM_API_KEY is not set — cannot run coverage test.");
    process.exit(1);
  }

  console.log("Track-level Last.fm tag coverage evaluation\n");
  console.log(`Testing ${TEST_TRACKS.length} tracks...\n`);

  const reports: TrackReport[] = [];
  for (const track of TEST_TRACKS) {
    reports.push(await analyseTrack(track.artist, track.title));
  }

  const blendFailures = await runBlendRegressionTests();

  const usableCount = reports.filter((r) => r.usableTrackTags).length;
  const strongerCount = reports.filter((r) => r.strongerThanArtist).length;
  const materialCount = reports.filter((r) => r.wouldChangeRecs).length;

  const choice = finalRecommendation(reports);

  console.log("\n" + "=".repeat(64));
  console.log("SUMMARY");
  console.log("=".repeat(64));
  console.log(`Tracks with usable track tags:              ${usableCount}/${reports.length}`);
  console.log(`Tracks with stronger track than artist signal: ${strongerCount}/${reports.length}`);
  console.log(`Tracks that would materially change recs:   ${materialCount}/${reports.length}`);
  console.log(`Strong coverage:  ${reports.filter((r) => r.trackQuality === "strong").length}`);
  console.log(`Medium coverage:  ${reports.filter((r) => r.trackQuality === "medium").length}`);
  console.log(`Weak coverage:    ${reports.filter((r) => r.trackQuality === "weak").length}`);
  console.log(`No coverage:      ${reports.filter((r) => r.trackQuality === "none").length}`);
  console.log(`\nRecommendation: ${recommendationLabel(choice)}`);

  if (blendFailures.length > 0) {
    console.error(`\n${blendFailures.length} blend regression failure(s):`);
    blendFailures.forEach((f) => console.error(`  ✗ ${f}`));
    process.exit(1);
  }

  console.log("\nAll blend regression tests passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
