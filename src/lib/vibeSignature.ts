import { isLastfmEnabled } from "./lastfm";
import { enrichRootTags } from "./tag-enrichment";
import { summariseTasteProfile } from "./tasteProfile";
import {
  getAvailableVibeDirections,
  summariseVibeProfile,
  type VibeProfile,
  type VibeProfileSummary,
} from "./vibeProfile";

export type VibeSignature = VibeProfileSummary & {
  profile: VibeProfile;
  availableDirections: ReturnType<typeof getAvailableVibeDirections>;
};

export function createVibeSignature(
  tasteProfile: import("./tasteProfile").TasteProfile,
  vibeProfile: VibeProfile,
): VibeSignature {
  const summary = summariseVibeProfile(vibeProfile);
  return {
    ...summary,
    profile: vibeProfile,
    availableDirections: getAvailableVibeDirections(vibeProfile),
  };
}

export async function buildRootVibeSignature(
  artistName: string,
  trackTitle?: string,
): Promise<VibeSignature | null> {
  if (!isLastfmEnabled() || !artistName.trim()) return null;

  if (trackTitle?.trim()) {
    const enrichment = await enrichRootTags({
      artistName,
      trackTitle,
    });
    if (enrichment.tags.length === 0) return null;
    return createVibeSignature(enrichment.tasteProfile, enrichment.vibeProfile);
  }

  const { getLastfmArtistTags } = await import("./lastfm");
  const { tagsToTasteProfile } = await import("./tasteProfile");
  const { deriveVibeProfile, tagsToWeightedTags } = await import("./vibeProfile");

  const tags = await getLastfmArtistTags(artistName);
  if (tags.length === 0) return null;

  const weightedTags = tagsToWeightedTags(tags);
  const tasteProfile = tagsToTasteProfile(tags);
  const vibeProfile = deriveVibeProfile(tasteProfile, weightedTags);

  return createVibeSignature(tasteProfile, vibeProfile);
}

export function formatVibeSignatureDebug(
  artistName: string,
  trackTitle: string,
  enrichment: Awaited<ReturnType<typeof enrichRootTags>>,
): string[] {
  const lines = [
    `Root: ${artistName} — ${trackTitle}`,
    `Track tags: ${enrichment.trackTagCount} | Artist tags: ${enrichment.artistTagCount}`,
    `Coverage: ${enrichment.coverage} | Blend: ${Math.round(enrichment.blendRatio.track * 100)}/${Math.round(enrichment.blendRatio.artist * 100)}`,
    `Taste: ${summariseTasteProfile(enrichment.tasteProfile).label}`,
    `Vibe: ${summariseVibeProfile(enrichment.vibeProfile).label}`,
  ];
  return lines;
}
