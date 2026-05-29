import {
  getLastfmArtistTags,
  getLastfmTrackTags,
  type LastfmTag,
} from "./lastfm";
import { filterStrongTags, getMusicFamily, isWeakFamilyTag } from "./music-family";
import {
  formatTasteProfileBlock,
  summariseTasteProfile,
  tagsToTasteProfile,
  type TasteProfile,
} from "./tasteProfile";
import {
  deriveVibeProfile,
  formatVibeProfileBlock,
  summariseVibeProfile,
  tagsToWeightedTags,
  type VibeProfile,
} from "./vibeProfile";

export type TagCoverageQuality = "strong" | "medium" | "weak" | "none";

export type EnrichedTag = LastfmTag & {
  /** Which layer contributed this tag after blending. */
  layer: "track" | "artist" | "blended";
  trackContribution?: number;
  artistContribution?: number;
};

export type BlendRatio = {
  track: number;
  artist: number;
};

export type BlendedTagProfile = {
  tags: EnrichedTag[];
  coverage: TagCoverageQuality;
  blendRatio: BlendRatio;
  trackTagCount: number;
  artistTagCount: number;
};

export type RootTagEnrichment = BlendedTagProfile & {
  tasteProfile: TasteProfile;
  vibeProfile: VibeProfile;
  musicFamily: ReturnType<typeof getMusicFamily>;
};

const JUNK_TAGS = new Set([
  "seen live",
  "seen",
  "favorite",
  "favourites",
  "favourite",
  "all time favorites",
  "all time favourites",
  "my favorites",
  "my favourites",
  "awesome",
  "beautiful",
  "love",
  "loved",
  "under 2000 listeners",
  "check out",
  "must see live",
  "my top songs",
  "personal favourites",
]);

/** Scene-specific tags that tighten close-hole matching when present on the root track. */
export const SCENE_TIGHTENING_TAGS = new Set([
  "thrash metal",
  "thrash",
  "brat",
  "jungle",
  "nu-disco",
  "nu disco",
  "breakbeat",
  "breakbeats",
  "hyperpop",
  "bubblegum bass",
  "brat",
  "speed garage",
  "uk garage",
  "future garage",
  "dubstep",
  "metalcore",
  "deathcore",
  "garage house",
  "rave",
  "idm",
]);

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

export function isJunkTag(tagName: string): boolean {
  return JUNK_TAGS.has(normalise(tagName));
}

export function meaningfulTags(tags: LastfmTag[]): LastfmTag[] {
  return tags.filter(
    (tag) => !isJunkTag(tag.name) && !isWeakFamilyTag(tag.name),
  );
}

export function classifyTagCoverage(tags: LastfmTag[]): TagCoverageQuality {
  const count = meaningfulTags(tags).length;
  if (count >= 5) return "strong";
  if (count >= 2) return "medium";
  if (count === 1) return "weak";
  return "none";
}

function resolveMusicFamily(input: {
  trackTags: LastfmTag[];
  artistTags: LastfmTag[];
  blendedTags: EnrichedTag[];
  coverage: TagCoverageQuality;
  tasteProfile: TasteProfile;
}): ReturnType<typeof getMusicFamily> {
  const trackTaste = tagsToTasteProfile(input.trackTags);
  const trackFamily = getMusicFamily(trackTaste, input.trackTags);
  const artistFamily = getMusicFamily(
    tagsToTasteProfile(input.artistTags),
    input.artistTags,
  );
  const blendedFamily = getMusicFamily(input.tasteProfile, input.blendedTags);

  if (input.coverage === "strong" || input.coverage === "medium") {
    if (trackFamily !== "unknown") return trackFamily;
  }

  if (blendedFamily !== "unknown") return blendedFamily;
  if (artistFamily !== "unknown") return artistFamily;
  return trackFamily;
}

function blendRatioForCoverage(coverage: TagCoverageQuality): BlendRatio {
  switch (coverage) {
    case "strong":
      return { track: 0.7, artist: 0.3 };
    case "medium":
      return { track: 0.5, artist: 0.5 };
    default:
      return { track: 0, artist: 1 };
  }
}

export function blendTrackAndArtistTags(
  trackTags: LastfmTag[],
  artistTags: LastfmTag[],
): BlendedTagProfile {
  const coverage = classifyTagCoverage(trackTags);
  const blendRatio = blendRatioForCoverage(coverage);

  if (coverage === "weak" || coverage === "none") {
    return {
      tags: artistTags.map((tag) => ({
        ...tag,
        layer: "artist" as const,
        artistContribution: tag.weight,
      })),
      coverage,
      blendRatio,
      trackTagCount: trackTags.length,
      artistTagCount: artistTags.length,
    };
  }

  const merged = new Map<string, EnrichedTag>();

  for (const tag of trackTags) {
    if (isJunkTag(tag.name)) continue;
    const key = normalise(tag.name);
    const contribution = tag.weight * blendRatio.track;
    merged.set(key, {
      ...tag,
      name: key,
      weight: contribution,
      layer: "track",
      trackContribution: contribution,
      artistContribution: 0,
    });
  }

  for (const tag of artistTags) {
    if (isJunkTag(tag.name)) continue;
    const key = normalise(tag.name);
    const contribution = tag.weight * blendRatio.artist;
    const existing = merged.get(key);
    if (existing) {
      existing.weight += contribution;
      existing.artistContribution = contribution;
      existing.layer = "blended";
      existing.count = Math.max(existing.count, tag.count);
    } else {
      merged.set(key, {
        ...tag,
        name: key,
        weight: contribution,
        layer: "artist",
        trackContribution: 0,
        artistContribution: contribution,
      });
    }
  }

  const tags = [...merged.values()].sort((a, b) => b.weight - a.weight);

  return {
    tags,
    coverage,
    blendRatio,
    trackTagCount: trackTags.length,
    artistTagCount: artistTags.length,
  };
}

export async function enrichRootTags(input: {
  artistName: string;
  trackTitle: string;
}): Promise<RootTagEnrichment> {
  const [trackTags, artistTags] = await Promise.all([
    getLastfmTrackTags(input.artistName, input.trackTitle),
    getLastfmArtistTags(input.artistName),
  ]);

  const blended = blendTrackAndArtistTags(trackTags, artistTags);
  const tasteProfile = tagsToTasteProfile(blended.tags);
  const weightedTags = tagsToWeightedTags(blended.tags);
  const vibeProfile = deriveVibeProfile(tasteProfile, weightedTags);
  const musicFamily = resolveMusicFamily({
    trackTags,
    artistTags,
    blendedTags: blended.tags,
    coverage: blended.coverage,
    tasteProfile,
  });

  const enrichment: RootTagEnrichment = {
    ...blended,
    tasteProfile,
    vibeProfile,
    musicFamily,
  };

  logRootTagEnrichment(input.artistName, input.trackTitle, enrichment);
  return enrichment;
}

export function rootSceneTags(tags: LastfmTag[]): string[] {
  return filterStrongTags(tags)
    .map((tag) => normalise(tag.name))
    .filter((name) => SCENE_TIGHTENING_TAGS.has(name));
}

export function sceneTagMatchBonus(
  rootTags: LastfmTag[],
  candidateTags: LastfmTag[],
): number {
  const scenes = new Set(rootSceneTags(rootTags));
  if (scenes.size === 0) return 0;

  let matches = 0;
  for (const tag of filterStrongTags(candidateTags)) {
    if (scenes.has(normalise(tag.name))) matches += 1;
  }
  return matches * 0.12;
}

export function logRootTagEnrichment(
  artistName: string,
  trackTitle: string,
  enrichment: RootTagEnrichment,
): void {
  if (process.env.TAG_ENRICHMENT_DEBUG !== "1" && process.env.RABBIT_HOLE_DEBUG !== "1") {
    return;
  }

  const topBlended = enrichment.tags
    .slice(0, 8)
    .map(
      (tag) =>
        `${tag.name} (${tag.weight.toFixed(2)}, ${tag.layer}${tag.trackContribution ? ` t=${tag.trackContribution.toFixed(2)}` : ""}${tag.artistContribution ? ` a=${tag.artistContribution.toFixed(2)}` : ""})`,
    )
    .join(", ");

  console.log("\n--- Root tag enrichment ---");
  console.log(`${artistName} — ${trackTitle}`);
  console.log(`Track tag count:   ${enrichment.trackTagCount}`);
  console.log(`Artist tag count:  ${enrichment.artistTagCount}`);
  console.log(`Coverage quality:  ${enrichment.coverage}`);
  console.log(
    `Blend ratio:       ${Math.round(enrichment.blendRatio.track * 100)}% track / ${Math.round(enrichment.blendRatio.artist * 100)}% artist`,
  );
  console.log(`Top blended tags:  ${topBlended || "(none)"}`);
  console.log(`Music family:      ${enrichment.musicFamily}`);
  console.log(`Taste summary:     ${summariseTasteProfile(enrichment.tasteProfile).label}`);
  console.log("TasteProfile:");
  formatTasteProfileBlock(enrichment.tasteProfile).forEach((line) => console.log(`  ${line}`));
  console.log(`Vibe summary:      ${summariseVibeProfile(enrichment.vibeProfile).label}`);
  console.log("VibeProfile:");
  formatVibeProfileBlock(enrichment.vibeProfile).forEach((line) => console.log(`  ${line}`));
}

export async function enrichRootTagsFromFetched(input: {
  artistName: string;
  trackTitle: string;
  trackTags: LastfmTag[];
  artistTags: LastfmTag[];
}): Promise<RootTagEnrichment> {
  const blended = blendTrackAndArtistTags(input.trackTags, input.artistTags);
  const tasteProfile = tagsToTasteProfile(blended.tags);
  const weightedTags = tagsToWeightedTags(blended.tags);
  const vibeProfile = deriveVibeProfile(tasteProfile, weightedTags);
  const musicFamily = resolveMusicFamily({
    trackTags: input.trackTags,
    artistTags: input.artistTags,
    blendedTags: blended.tags,
    coverage: blended.coverage,
    tasteProfile,
  });

  const enrichment: RootTagEnrichment = {
    ...blended,
    tasteProfile,
    vibeProfile,
    musicFamily,
  };

  logRootTagEnrichment(input.artistName, input.trackTitle, enrichment);
  return enrichment;
}
