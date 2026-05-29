import type { LastfmTag } from "./lastfm";

export type TasteDimension =
  | "energy"
  | "softness"
  | "heaviness"
  | "aggression"
  | "extremity"
  | "darkness"
  | "emotion"
  | "club"
  | "experimental"
  | "nostalgia"
  | "acoustic"
  | "electronic"
  | "mainstream"
  | "underground";

export const TASTE_DIMENSIONS: TasteDimension[] = [
  "energy",
  "softness",
  "heaviness",
  "aggression",
  "extremity",
  "darkness",
  "emotion",
  "club",
  "experimental",
  "nostalgia",
  "acoustic",
  "electronic",
  "mainstream",
  "underground",
];

export type WeightedTag = {
  name: string;
  weight: number;
};

export type TasteProfile = Record<TasteDimension, number>;

export type TasteScoreTier = "low" | "moderate" | "high" | "defining";

export type TasteProfileSummary = {
  highlights: Array<{ dimension: TasteDimension; score: number; tier: TasteScoreTier }>;
  label: string;
};

export type DirectionChip =
  | "softer"
  | "heavier"
  | "weirder"
  | "more_clubby"
  | "more_emotional"
  | "more_underground";

/** Junk / self-referential Last.fm tags — excluded from scoring. */
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
  "british",
  "american",
  "english",
  "welsh",
  "scottish",
  "irish",
  "canadian",
  "australian",
  "female vocalists",
  "male vocalists",
  "metallica",
  "under 2000 listeners",
  "awesome",
  "beautiful",
  "love",
  "loved",
  "recommended",
  "check out",
  "must see live",
]);

/** Blend weights for the top 5 dominant tags per dimension. */
const DOMINANT_BLEND = [1, 0.42, 0.22, 0.1, 0.05] as const;

/** Maps Last.fm tags to 0–100 taste dimension targets. */
export const TAG_WEIGHTS: Record<string, Partial<Record<TasteDimension, number>>> = {
  // Metal spectrum — calibrated for heaviness vs aggression vs extremity
  "heavy metal": { heaviness: 78, energy: 65, aggression: 55, extremity: 45, darkness: 50 },
  "thrash metal": { heaviness: 82, energy: 82, aggression: 75, extremity: 60, darkness: 55 },
  "thrash": { heaviness: 82, energy: 82, aggression: 75, extremity: 60, darkness: 55 },
  metalcore: { heaviness: 85, energy: 78, aggression: 82, extremity: 68, darkness: 62 },
  hardcore: { heaviness: 80, energy: 85, aggression: 90, extremity: 75, underground: 70 },
  "beatdown hardcore": { heaviness: 92, aggression: 96, extremity: 88, energy: 80, underground: 75 },
  beatdown: { heaviness: 92, aggression: 96, extremity: 88, energy: 80, underground: 75 },
  deathcore: { heaviness: 95, aggression: 95, extremity: 92, darkness: 80, underground: 82 },
  "brutal deathcore": { heaviness: 98, aggression: 98, extremity: 97, darkness: 85, underground: 90 },
  "death metal": { heaviness: 92, aggression: 90, extremity: 90, darkness: 78, underground: 85 },
  "black metal": { heaviness: 82, aggression: 86, extremity: 94, darkness: 95, underground: 92 },
  "alternative metal": { heaviness: 68, aggression: 58, extremity: 42, emotion: 68, darkness: 50 },
  "hard rock": { heaviness: 55, energy: 68, aggression: 45, extremity: 25, mainstream: 55 },
  metal: { heaviness: 75, energy: 68, aggression: 58, extremity: 48, darkness: 52 },
  doom: { heaviness: 88, darkness: 85, emotion: 55, extremity: 55, energy: 35 },
  sludge: { heaviness: 90, aggression: 65, darkness: 80, extremity: 70, underground: 75 },
  grindcore: { heaviness: 85, aggression: 95, extremity: 95, energy: 90, underground: 88 },
  posthardcore: { heaviness: 72, aggression: 78, energy: 80, extremity: 55, emotion: 60 },
  "post-hardcore": { heaviness: 72, aggression: 78, energy: 80, extremity: 55, emotion: 60 },
  punk: { energy: 82, aggression: 72, extremity: 50, underground: 65, heaviness: 45 },

  // Pop & electronic
  pop: { mainstream: 85, energy: 65, extremity: 10, emotion: 55 },
  "art pop": { mainstream: 55, experimental: 50, emotion: 65, energy: 55 },
  hyperpop: { electronic: 85, energy: 82, experimental: 75, extremity: 45, mainstream: 35 },
  "uk garage": { club: 82, electronic: 85, energy: 72, nostalgia: 72, underground: 55 },
  "future garage": { club: 60, electronic: 82, emotion: 78, darkness: 58, nostalgia: 75 },
  garage: { club: 75, electronic: 78, energy: 68, nostalgia: 65, underground: 50 },
  ambient: { softness: 88, emotion: 65, energy: 15, experimental: 45, electronic: 35, darkness: 55 },
  dubstep: { electronic: 85, club: 75, darkness: 72, heaviness: 45, underground: 60 },
  "drum and bass": { club: 78, energy: 85, electronic: 82, heaviness: 40, underground: 55 },
  dnb: { club: 78, energy: 85, electronic: 82, heaviness: 40, underground: 55 },
  breakbeat: { club: 72, energy: 78, electronic: 75, nostalgia: 62, underground: 50 },
  techno: { club: 85, electronic: 88, energy: 72, underground: 65, extremity: 40 },
  house: { club: 88, electronic: 82, energy: 68, mainstream: 45, nostalgia: 40 },
  electronic: { electronic: 82, club: 55, energy: 58, experimental: 35 },
  electronica: { electronic: 80, experimental: 45, emotion: 50, underground: 45 },
  idm: { experimental: 82, electronic: 85, underground: 75, extremity: 55 },
  trance: { electronic: 80, energy: 75, emotion: 60, club: 65 },
  "progressive house": { electronic: 78, club: 68, energy: 62, emotion: 50 },
  progressive: { electronic: 65, emotion: 55, energy: 50, experimental: 40 },

  // Rock / alternative / mood
  rock: { energy: 68, heaviness: 52, aggression: 42, mainstream: 50, extremity: 30 },
  alternative: { underground: 55, emotion: 58, energy: 60, extremity: 35 },
  "alternative rock": { energy: 65, emotion: 60, heaviness: 48, mainstream: 45, extremity: 30 },
  indie: { underground: 60, emotion: 55, acoustic: 40, extremity: 35 },
  shoegaze: { softness: 55, emotion: 75, experimental: 55, darkness: 50, underground: 55 },
  postrock: { emotion: 78, experimental: 65, softness: 45, heaviness: 38, energy: 35 },
  "post-rock": { emotion: 78, experimental: 65, softness: 45, heaviness: 38, energy: 35 },
  folk: { acoustic: 82, emotion: 62, softness: 55, nostalgia: 58, mainstream: 30 },
  acoustic: { acoustic: 90, softness: 75, emotion: 55, energy: 25 },
  jazz: { emotion: 65, experimental: 50, acoustic: 55, underground: 40 },
  soul: { emotion: 78, mainstream: 50, nostalgia: 55, softness: 40 },
  rnb: { emotion: 70, mainstream: 65, club: 45, energy: 55 },
  "hip hop": { energy: 62, mainstream: 70, underground: 40, aggression: 35 },
  rap: { energy: 68, mainstream: 68, underground: 45, aggression: 40 },
  experimental: { experimental: 88, underground: 72, extremity: 65, electronic: 40, darkness: 42 },
  disco: { club: 78, nostalgia: 68, mainstream: 55, energy: 65 },
  synthpop: { electronic: 72, mainstream: 58, nostalgia: 52, emotion: 45 },
  classical: { acoustic: 80, emotion: 72, softness: 65, energy: 20 },
  "nu metal": { heaviness: 72, aggression: 68, energy: 75, extremity: 50, mainstream: 45 },
  "progressive metal": { heaviness: 78, emotion: 82, experimental: 55, extremity: 48, darkness: 55 },
  "sludge metal": { heaviness: 88, darkness: 78, aggression: 70, extremity: 65, underground: 70 },
  rave: { club: 80, energy: 82, electronic: 75, nostalgia: 60, underground: 45 },
  dance: { club: 72, energy: 70, mainstream: 55, electronic: 55 },
  "speed metal": { heaviness: 82, energy: 85, aggression: 72, extremity: 58, darkness: 50 },
  electropop: { mainstream: 78, electronic: 72, energy: 62, extremity: 15 },
  "dance-pop": { mainstream: 80, energy: 68, club: 62, extremity: 12 },
  "deep house": { club: 75, electronic: 78, emotion: 55, nostalgia: 50 },
  "electro house": { club: 78, electronic: 82, energy: 72, mainstream: 40 },
  "tech house": { club: 82, electronic: 80, energy: 68, underground: 50 },
  djent: { heaviness: 72, aggression: 55, experimental: 62, emotion: 65, extremity: 45 },
  "progressive rock": { emotion: 72, experimental: 58, energy: 55, heaviness: 42, extremity: 35 },
  "post-metal": { heaviness: 75, darkness: 72, emotion: 70, experimental: 55, extremity: 50 },
  "metallic hardcore": { heaviness: 84, aggression: 88, energy: 82, extremity: 72 },
  "hardcore punk": { aggression: 85, energy: 88, extremity: 65, underground: 72, heaviness: 55 },
  minimal: { electronic: 70, experimental: 55, softness: 45, energy: 35, underground: 50 },
  electro: { electronic: 78, energy: 68, club: 55, mainstream: 35 },
};

const DIMENSION_LABELS: Record<TasteDimension, string> = {
  energy: "Energetic",
  softness: "Soft",
  heaviness: "Heavy",
  aggression: "Aggressive",
  extremity: "Extreme",
  darkness: "Dark",
  emotion: "Emotional",
  club: "Clubby",
  experimental: "Experimental",
  nostalgia: "Nostalgic",
  acoustic: "Acoustic",
  electronic: "Electronic",
  mainstream: "Mainstream",
  underground: "Underground",
};

function emptyProfile(): TasteProfile {
  return Object.fromEntries(TASTE_DIMENSIONS.map((d) => [d, 0])) as TasteProfile;
}

function normaliseTag(value: string): string {
  return value.toLowerCase().trim();
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function resolveTagWeights(tagName: string): Partial<Record<TasteDimension, number>> | null {
  const key = normaliseTag(tagName);
  if (JUNK_TAGS.has(key)) return null;
  if (TAG_WEIGHTS[key]) return TAG_WEIGHTS[key];

  // Longest partial match for compound tags (e.g. "melodic death metal")
  const keys = Object.keys(TAG_WEIGHTS).sort((a, b) => b.length - a.length);
  for (const candidate of keys) {
    if (key.includes(candidate) || candidate.includes(key)) {
      return TAG_WEIGHTS[candidate]!;
    }
  }

  return null;
}

type RankedTag = {
  tag: WeightedTag;
  mapped: Partial<Record<TasteDimension, number>>;
  relevance: number;
};

function rankTags(tags: WeightedTag[]): RankedTag[] {
  const ranked: RankedTag[] = [];

  for (const tag of tags) {
    const mapped = resolveTagWeights(tag.name);
    if (!mapped) continue;

    const peak = Math.max(...Object.values(mapped));
    ranked.push({
      tag,
      mapped,
      relevance: tag.weight * (peak / 100),
    });
  }

  return ranked.sort((a, b) => b.relevance - a.relevance);
}

/** Classify a 0–100 score for display. */
export function tasteScoreTier(score: number): TasteScoreTier {
  if (score >= 80) return "defining";
  if (score >= 60) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

export function formatTasteScoreTier(tier: TasteScoreTier): string {
  return tier;
}

function refineTasteProfile(profile: TasteProfile, ranked: RankedTag[]): TasteProfile {
  const refined = { ...profile };
  const tagNames = ranked.map((entry) => normaliseTag(entry.tag.name));
  const hasAmbient = tagNames.includes("ambient");
  const hasFutureGarage = tagNames.some((name) => name.includes("future garage"));
  const hasDubstep = tagNames.includes("dubstep");

  if (hasAmbient && hasFutureGarage) {
    refined.darkness = clamp(Math.max(refined.darkness, 75));
  } else if (hasAmbient && refined.darkness >= 68 && refined.darkness < 75) {
    refined.darkness = 75;
  }

  if (hasAmbient && (hasFutureGarage || hasDubstep) && refined.club > 70) {
    refined.club = clamp(Math.round(refined.club * 0.68 + 55 * 0.32));
  }

  if (refined.emotion >= 78 && refined.aggression < 62 && refined.heaviness > 70) {
    refined.heaviness = clamp(Math.min(70, Math.round(refined.heaviness * 0.72 + 48 * 0.28)));
  }

  return refined;
}

/** Score Last.fm tags into a 0–100 taste profile using dominant-tag weighting. */
export function scoreTagsToTasteProfile(tags: WeightedTag[]): TasteProfile {
  const ranked = rankTags(tags);
  if (ranked.length === 0) return emptyProfile();

  const dominant = ranked.slice(0, 5);
  const nudge = ranked.slice(5);
  const profile = emptyProfile();

  for (const dimension of TASTE_DIMENSIONS) {
    const fromDominant = dominant
      .map((entry, index) => ({
        value: entry.mapped[dimension],
        rankWeight: DOMINANT_BLEND[index]! * entry.relevance,
      }))
      .filter((entry): entry is { value: number; rankWeight: number } => entry.value !== undefined);

    if (fromDominant.length === 0) continue;

    const peak = Math.max(...fromDominant.map((entry) => entry.value));
    const reinforcement = fromDominant.reduce(
      (sum, entry) => sum + entry.value * entry.rankWeight * 0.28,
      0,
    );

    let score = peak * 0.97 + reinforcement * 0.18;

    for (const entry of nudge) {
      const value = entry.mapped[dimension];
      if (value === undefined || value < 30) continue;
      score += (value - score) * 0.04 * entry.relevance;
    }

    profile[dimension] = clamp(Math.round(score));
  }

  return refineTasteProfile(profile, ranked);
}

export function tagsToTasteProfile(tags: LastfmTag[]): TasteProfile {
  return scoreTagsToTasteProfile(
    tags.map((tag) => ({ name: tag.name, weight: tag.weight })),
  );
}

/** Returns 0–1 closeness between two taste profiles. */
export function compareTasteProfiles(
  candidate: TasteProfile,
  root: TasteProfile,
): number {
  let sumSquaredDiff = 0;

  for (const dimension of TASTE_DIMENSIONS) {
    const diff = (candidate[dimension] ?? 0) - (root[dimension] ?? 0);
    sumSquaredDiff += diff * diff;
  }

  const maxDistance = Math.sqrt(TASTE_DIMENSIONS.length * 100 * 100);
  return Math.max(0, 1 - Math.sqrt(sumSquaredDiff) / maxDistance);
}

/** Describe how a candidate differs from root on taste axes. */
export function getDirectionalLabel(
  candidate: TasteProfile,
  root: TasteProfile,
): string {
  const threshold = 12;

  const deltas = TASTE_DIMENSIONS.map((dimension) => ({
    dimension,
    delta: (candidate[dimension] ?? 0) - (root[dimension] ?? 0),
  }))
    .filter((entry) => Math.abs(entry.delta) >= threshold)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  if (deltas.length === 0) return "Close taste match";

  const top = deltas.slice(0, 2);
  const parts = top.map((entry) => {
    const higher = entry.delta > 0;
    switch (entry.dimension) {
      case "softness":
        return higher ? "softer" : "harder-edged";
      case "heaviness":
        return higher ? "heavier" : "lighter";
      case "aggression":
        return higher ? "more aggressive" : "less confrontational";
      case "extremity":
        return higher ? "more extreme" : "more accessible";
      case "experimental":
        return higher ? "weirder" : "more conventional";
      case "club":
        return higher ? "more clubby" : "less club-focused";
      case "emotion":
        return higher ? "more emotional" : "cooler";
      case "underground":
        return higher ? "more underground" : "more mainstream";
      case "energy":
        return higher ? "higher energy" : "calmer";
      case "darkness":
        return higher ? "darker" : "brighter";
      case "electronic":
        return higher ? "more electronic" : "more organic";
      case "acoustic":
        return higher ? "more acoustic" : "more produced";
      case "mainstream":
        return higher ? "more mainstream" : "more niche";
      case "nostalgia":
        return higher ? "more nostalgic" : "more contemporary";
      default:
        return higher ? "more intense" : "more restrained";
    }
  });

  return parts.join(" · ");
}

export function summariseTasteProfile(profile: TasteProfile): TasteProfileSummary {
  const highlights = TASTE_DIMENSIONS.map((dimension) => ({
    dimension,
    score: profile[dimension] ?? 0,
    tier: tasteScoreTier(profile[dimension] ?? 0),
  }))
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);

  const label =
    highlights.length > 0
      ? highlights
          .map((h) => {
            const tierLabel =
              h.tier === "defining" ? DIMENSION_LABELS[h.dimension] : `${DIMENSION_LABELS[h.dimension]}`;
            return tierLabel;
          })
          .join(" · ")
      : "Mixed palette";

  return { highlights, label };
}

export function formatDimensionLine(dimension: TasteDimension, score: number): string {
  const tier = tasteScoreTier(score);
  return `${dimension.padEnd(14)} ${String(Math.round(score)).padStart(3)}  (${tier})`;
}

export function formatTasteProfileBlock(profile: TasteProfile): string[] {
  return TASTE_DIMENSIONS.map((dimension) =>
    formatDimensionLine(dimension, profile[dimension] ?? 0),
  );
}

export function getDirectionHints(
  candidate: TasteProfile,
  root: TasteProfile,
): DirectionChip[] {
  const hints: DirectionChip[] = [];
  const threshold = 15;

  if ((candidate.softness ?? 0) - (root.softness ?? 0) >= threshold) hints.push("softer");
  if ((candidate.heaviness ?? 0) - (root.heaviness ?? 0) >= threshold) hints.push("heavier");
  if ((candidate.experimental ?? 0) - (root.experimental ?? 0) >= threshold) {
    hints.push("weirder");
  }
  if ((candidate.club ?? 0) - (root.club ?? 0) >= threshold) hints.push("more_clubby");
  if ((candidate.emotion ?? 0) - (root.emotion ?? 0) >= threshold) {
    hints.push("more_emotional");
  }
  if ((candidate.underground ?? 0) - (root.underground ?? 0) >= threshold) {
    hints.push("more_underground");
  }

  return hints;
}

export function getAvailableDirections(root: TasteProfile): DirectionChip[] {
  const options: DirectionChip[] = [];
  if ((root.softness ?? 0) < 60) options.push("softer");
  if ((root.heaviness ?? 0) < 60) options.push("heavier");
  if ((root.experimental ?? 0) < 60) options.push("weirder");
  if ((root.club ?? 0) < 60) options.push("more_clubby");
  if ((root.emotion ?? 0) < 60) options.push("more_emotional");
  if ((root.underground ?? 0) < 60) options.push("more_underground");
  return options;
}

export function sharedTagNames(rootTags: LastfmTag[], candidateTags: LastfmTag[]): string[] {
  const rootSet = new Set(rootTags.map((tag) => normaliseTag(tag.name)));
  return candidateTags
    .map((tag) => tag.name)
    .filter((name) => rootSet.has(normaliseTag(name)))
    .slice(0, 4);
}

export type TasteExpectation = {
  label: string;
  checks: Array<{
    dimension: TasteDimension;
    min?: number;
    max?: number;
  }>;
};

export function assertTasteExpectations(
  artist: string,
  profile: TasteProfile,
  expectations: TasteExpectation[],
): { passed: string[]; failed: string[] } {
  const passed: string[] = [];
  const failed: string[] = [];

  for (const spec of expectations) {
    if (spec.label !== artist) continue;

    for (const check of spec.checks) {
      const value = profile[check.dimension] ?? 0;
      const minOk = check.min === undefined || value >= check.min;
      const maxOk = check.max === undefined || value <= check.max;

      const range =
        check.min !== undefined && check.max !== undefined
          ? `${check.min}-${check.max}`
          : check.min !== undefined
            ? `>= ${check.min}`
            : `<= ${check.max}`;

      const line = `${check.dimension} ${range} (got ${Math.round(value)})`;

      if (minOk && maxOk) passed.push(line);
      else failed.push(line);
    }
  }

  return { passed, failed };
}

export const TASTE_EXPECTATIONS: TasteExpectation[] = [
  {
    label: "Metallica",
    checks: [
      { dimension: "heaviness", min: 70, max: 85 },
      { dimension: "aggression", min: 55, max: 75 },
      { dimension: "extremity", min: 40, max: 65 },
    ],
  },
  {
    label: "Knocked Loose",
    checks: [
      { dimension: "heaviness", min: 85 },
      { dimension: "aggression", min: 90 },
      { dimension: "extremity", min: 75 },
    ],
  },
  {
    label: "Sleep Token",
    checks: [
      { dimension: "emotion", min: 80 },
      { dimension: "heaviness", min: 45, max: 70 },
      { dimension: "aggression", max: 60 },
    ],
  },
  {
    label: "Burial",
    checks: [
      { dimension: "darkness", min: 75 },
      { dimension: "electronic", min: 80 },
      { dimension: "club", min: 45, max: 70 },
    ],
  },
  {
    label: "Overmono",
    checks: [
      { dimension: "electronic", min: 80 },
      { dimension: "club", min: 70 },
      { dimension: "nostalgia", min: 60 },
    ],
  },
  {
    label: "Dua Lipa",
    checks: [
      { dimension: "mainstream", min: 75 },
      { dimension: "energy", min: 60 },
      { dimension: "extremity", max: 25 },
    ],
  },
];
