import type { TasteProfile, WeightedTag } from "./tasteProfile";

export type VibeDimension =
  | "nostalgia"
  | "euphoria"
  | "catharsis"
  | "destruction"
  | "scale"
  | "warmth"
  | "futurism"
  | "intimacy"
  | "playfulness"
  | "melancholy";

export const VIBE_DIMENSIONS: VibeDimension[] = [
  "nostalgia",
  "euphoria",
  "catharsis",
  "destruction",
  "scale",
  "warmth",
  "futurism",
  "intimacy",
  "playfulness",
  "melancholy",
];

export type VibeProfile = Record<VibeDimension, number>;

export type VibeScoreTier = "low" | "moderate" | "high" | "defining";

/** Human-facing adjective labels for vibe dimensions. */
export const VIBE_DISPLAY_LABELS: Record<VibeDimension, string> = {
  destruction: "destructive",
  euphoria: "euphoric",
  nostalgia: "nostalgic",
  scale: "cinematic",
  futurism: "futuristic",
  intimacy: "intimate",
  playfulness: "playful",
  melancholy: "melancholic",
  catharsis: "cathartic",
  warmth: "warm",
};

const JUNK_TAGS = new Set([
  "seen live",
  "seen",
  "favorite",
  "favourites",
  "favourite",
  "british",
  "american",
  "female vocalists",
  "male vocalists",
  "awesome",
  "beautiful",
  "love",
  "loved",
]);

/** Last.fm tag → vibe dimension signal strengths (0–100). */
const VIBE_TAG_SIGNALS: Record<string, Partial<Record<VibeDimension, number>>> = {
  // Nostalgia / era
  synthwave: { nostalgia: 92, futurism: 50, scale: 55 },
  retrowave: { nostalgia: 88, futurism: 48 },
  retro: { nostalgia: 82, playfulness: 35 },
  "uk garage": { nostalgia: 78, euphoria: 72, catharsis: 62, intimacy: 52, melancholy: 55 },
  "2-step": { nostalgia: 72, melancholy: 72, intimacy: 58, euphoria: 50 },
  "future garage": { nostalgia: 72, melancholy: 68, intimacy: 55, catharsis: 48 },
  garage: { nostalgia: 68, euphoria: 58, catharsis: 52 },
  y2k: { nostalgia: 85, playfulness: 62, futurism: 45 },
  "new wave": { nostalgia: 75, futurism: 40 },
  "80s": { nostalgia: 90 },
  "90s": { nostalgia: 85 },
  disco: { nostalgia: 72, euphoria: 68, playfulness: 45, catharsis: 50 },
  synthpop: { nostalgia: 78, futurism: 48, euphoria: 58, scale: 62 },
  "stutter house": { euphoria: 82, catharsis: 68, nostalgia: 55 },
  "future bass": { nostalgia: 70, euphoria: 62, futurism: 55, playfulness: 50 },
  "bubblegum bass": { futurism: 92, playfulness: 82, nostalgia: 68, euphoria: 55 },
  electropop: { nostalgia: 65, playfulness: 58, euphoria: 52, futurism: 50 },
  "dance-pop": { euphoria: 62, nostalgia: 55, playfulness: 45 },
  "electro house": { euphoria: 68, futurism: 62, nostalgia: 52, catharsis: 48 },
  eurobeat: { euphoria: 70, nostalgia: 60, playfulness: 55 },

  // Scale / cinematic
  cinematic: { scale: 95, melancholy: 45, catharsis: 55 },
  anthemic: { scale: 88, euphoria: 62, catharsis: 58 },
  epic: { scale: 92, catharsis: 65, destruction: 35 },
  orchestral: { scale: 90, warmth: 45, melancholy: 40 },
  shoegaze: { scale: 70, melancholy: 72, intimacy: 55, nostalgia: 72 },
  postrock: { scale: 85, catharsis: 70, melancholy: 55 },
  "post-rock": { scale: 85, catharsis: 70, melancholy: 55 },
  "dream pop": { scale: 72, warmth: 72, melancholy: 65, intimacy: 58, nostalgia: 78 },
  dreampop: { scale: 72, warmth: 72, melancholy: 65, intimacy: 58, nostalgia: 78 },

  // Warmth / intimacy
  soul: { warmth: 85, intimacy: 55, catharsis: 50 },
  folk: { warmth: 82, intimacy: 68, nostalgia: 45 },
  acoustic: { warmth: 78, intimacy: 72 },
  organic: { warmth: 80, intimacy: 50 },
  warm: { warmth: 90 },
  dreamy: { warmth: 72, intimacy: 62, melancholy: 40 },
  "singer-songwriter": { intimacy: 88, warmth: 70, melancholy: 45 },
  "bedroom pop": { intimacy: 82, warmth: 55, playfulness: 40 },
  "lo-fi": { intimacy: 80, warmth: 60, melancholy: 50 },
  "lofi": { intimacy: 80, warmth: 60, melancholy: 50 },
  minimal: { intimacy: 65, futurism: 40, melancholy: 35 },
  soft: { intimacy: 75, warmth: 68, melancholy: 35 },
  ambient: { melancholy: 62, intimacy: 58, scale: 45, warmth: 40 },
  atmospheric: { melancholy: 68, scale: 55, intimacy: 48 },

  // Futurism
  hyperpop: { futurism: 95, playfulness: 78, euphoria: 55, nostalgia: 45 },
  glitch: { futurism: 88, playfulness: 55 },
  "pc music": { futurism: 94, playfulness: 75, nostalgia: 40 },
  industrial: { futurism: 82, destruction: 55, melancholy: 45 },
  "deconstructed club": { futurism: 84, destruction: 35 },
  experimental: { futurism: 75, playfulness: 40 },
  idm: { futurism: 78, intimacy: 35 },
  electro: { futurism: 68, euphoria: 50 },
  techno: { futurism: 62, euphoria: 45 },
  electronica: { futurism: 65, melancholy: 35 },

  // Playfulness
  wonky: { playfulness: 82, futurism: 55 },
  quirky: { playfulness: 85 },
  bubblegum: { playfulness: 88, euphoria: 55 },
  fun: { playfulness: 80, euphoria: 60 },
  colourful: { playfulness: 75, euphoria: 50 },
  "colorful": { playfulness: 75, euphoria: 50 },
  kawaii: { playfulness: 85, futurism: 45 },

  // Melancholy / catharsis
  sad: { melancholy: 88, intimacy: 45, catharsis: 55 },
  melancholic: { melancholy: 92, intimacy: 50 },
  emo: { melancholy: 75, catharsis: 68, destruction: 30 },
  dubstep: { melancholy: 58, destruction: 35, futurism: 45 },
  dark: { melancholy: 80, destruction: 40 },
  "post-hardcore": { catharsis: 75, destruction: 55 },
  posthardcore: { catharsis: 75, destruction: 55 },
  hardcore: { catharsis: 85, destruction: 70 },
  "beatdown hardcore": { catharsis: 88, destruction: 85 },
  beatdown: { catharsis: 86, destruction: 82 },
  "metallic hardcore": { catharsis: 82, destruction: 78 },
  metalcore: { catharsis: 78, destruction: 75 },
  house: { euphoria: 76, catharsis: 58, nostalgia: 42, scale: 45 },
  trance: { euphoria: 78, scale: 55, catharsis: 50 },
  "progressive house": { euphoria: 65, scale: 60, catharsis: 55 },
  "art pop": { playfulness: 45, futurism: 50, intimacy: 40 },
};

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, value));
}

function normaliseTag(value: string): string {
  return value.toLowerCase().trim();
}

function resolveVibeTagSignals(tagName: string): Partial<Record<VibeDimension, number>> | null {
  const key = normaliseTag(tagName);
  if (JUNK_TAGS.has(key)) return null;
  if (VIBE_TAG_SIGNALS[key]) return VIBE_TAG_SIGNALS[key];

  const keys = Object.keys(VIBE_TAG_SIGNALS).sort((a, b) => b.length - a.length);
  for (const candidate of keys) {
    if (key.includes(candidate) || candidate.includes(key)) {
      return VIBE_TAG_SIGNALS[candidate]!;
    }
  }

  return null;
}

function scoreVibeTagSignal(tags: WeightedTag[], dimension: VibeDimension): number {
  let peak = 0;
  let reinforcement = 0;

  for (const tag of tags) {
    const signals = resolveVibeTagSignals(tag.name);
    const value = signals?.[dimension];
    if (value === undefined) continue;

    peak = Math.max(peak, value * (0.88 + 0.12 * tag.weight));
    reinforcement += value * tag.weight * 0.14;
  }

  if (peak === 0) return 0;
  return clamp(Math.round(peak * 0.9 + Math.min(reinforcement, 22)));
}

function blendScores(tastePart: number, tagPart: number, tasteWeight: number): number {
  if (tagPart <= 0) return clamp(Math.round(tastePart));

  const adaptiveWeight =
    tagPart >= tastePart + 18 ? tasteWeight * 0.55 : tasteWeight;

  return clamp(Math.round(tastePart * adaptiveWeight + tagPart * (1 - adaptiveWeight)));
}

function refineVibeProfile(
  vibe: VibeProfile,
  taste: TasteProfile,
  tags: WeightedTag[],
): VibeProfile {
  const refined = { ...vibe };
  const tagNames = tags.map((tag) => normaliseTag(tag.name));
  const tagCatharsis = scoreVibeTagSignal(tags, "catharsis");
  const hasAmbient = tagNames.includes("ambient");
  const hasDubstep = tagNames.includes("dubstep");
  const hasUkGarage = tagNames.some((name) => name.includes("uk garage") || name.includes("2-step"));

  if (hasAmbient && (hasDubstep || hasUkGarage)) {
    refined.melancholy = clamp(Math.max(refined.melancholy, 76));
    refined.intimacy = clamp(Math.max(refined.intimacy, 52));
  }

  if (hasUkGarage && taste.club >= 60) {
    refined.euphoria = clamp(Math.max(refined.euphoria, 76));
    refined.catharsis = clamp(Math.max(refined.catharsis, 62));
    refined.nostalgia = clamp(Math.max(refined.nostalgia, 68));
  }

  if (refined.destruction >= 82) {
    refined.catharsis = clamp(
      Math.max(
        refined.catharsis,
        Math.round(refined.destruction * 0.84 + taste.emotion * 0.1 + tagCatharsis * 0.06),
      ),
    );
  }

  const hasShoegazeOrPostRock = tagNames.some(
    (name) => name.includes("shoegaze") || name.includes("post-rock") || name.includes("postrock"),
  );
  const hasDreamPop = tagNames.some((name) => name.includes("dream pop") || name.includes("dreampop"));

  if (hasShoegazeOrPostRock || hasDreamPop) {
    refined.nostalgia = clamp(Math.max(refined.nostalgia, 80));
    refined.scale = clamp(Math.max(refined.scale, 80));
  }

  const hasHyperpopCluster = tagNames.some(
    (name) =>
      name.includes("hyperpop") ||
      name.includes("pc music") ||
      name.includes("bubblegum") ||
      name.includes("deconstructed"),
  );
  if (hasHyperpopCluster) {
    refined.futurism = clamp(Math.max(refined.futurism, 90));
  }

  const hasBubblegumOrFutureBass = tagNames.some(
    (name) => name.includes("bubblegum") || name.includes("future bass"),
  );
  if (hasBubblegumOrFutureBass && taste.electronic >= 60) {
    refined.nostalgia = clamp(Math.max(refined.nostalgia, 66));
  }

  return refined;
}

/** Derive a human-facing vibe profile from internal taste scores and weighted tags. */
export function deriveVibeProfile(
  tasteProfile: TasteProfile,
  weightedTags: WeightedTag[],
): VibeProfile {
  const usableTags = weightedTags.filter((tag) => !JUNK_TAGS.has(normaliseTag(tag.name)));

  const tagNostalgia = scoreVibeTagSignal(usableTags, "nostalgia");
  const tagScale = scoreVibeTagSignal(usableTags, "scale");
  const tagWarmth = scoreVibeTagSignal(usableTags, "warmth");
  const tagFuturism = scoreVibeTagSignal(usableTags, "futurism");
  const tagIntimacy = scoreVibeTagSignal(usableTags, "intimacy");
  const tagPlayfulness = scoreVibeTagSignal(usableTags, "playfulness");
  const tagMelancholy = scoreVibeTagSignal(usableTags, "melancholy");
  const tagCatharsis = scoreVibeTagSignal(usableTags, "catharsis");

  const brightness = clamp(100 - tasteProfile.darkness);
  const impact = (tasteProfile.heaviness + tasteProfile.aggression) / 2;

  const warmth = blendScores(
    tasteProfile.acoustic * 0.45 + tasteProfile.emotion * 0.25 + tasteProfile.softness * 0.2 + brightness * 0.1,
    tagWarmth,
    0.48,
  );

  const intimacy = blendScores(
    tasteProfile.acoustic * 0.4 +
      tasteProfile.softness * 0.3 +
      tasteProfile.emotion * 0.15 +
      (100 - tasteProfile.club) * 0.08 +
      warmth * 0.07,
    tagIntimacy,
    0.45,
  );

  const nostalgia = blendScores(
    tasteProfile.nostalgia * 0.72 + tasteProfile.underground * 0.08 + warmth * 0.1 + tasteProfile.emotion * 0.1,
    tagNostalgia,
    0.42,
  );

  const scale = blendScores(
    tasteProfile.emotion * 0.22 +
      tasteProfile.energy * 0.18 +
      tasteProfile.heaviness * 0.12 +
      tasteProfile.electronic * 0.08 +
      tasteProfile.experimental * 0.08,
    tagScale,
    0.38,
  );

  const futurism = blendScores(
    tasteProfile.electronic * 0.42 +
      tasteProfile.experimental * 0.28 +
      tasteProfile.extremity * 0.12 +
      (100 - tasteProfile.acoustic) * 0.08,
    tagFuturism,
    0.4,
  );

  const playfulness = blendScores(
    tasteProfile.energy * 0.22 +
      tasteProfile.experimental * 0.18 +
      futurism * 0.15 +
      (100 - tasteProfile.darkness) * 0.12 +
      (100 - tasteProfile.heaviness) * 0.08,
    tagPlayfulness,
    0.42,
  );

  const melancholy = blendScores(
    tasteProfile.darkness * 0.38 +
      tasteProfile.emotion * 0.22 +
      tasteProfile.softness * 0.12 +
      (100 - tasteProfile.energy) * 0.1 +
      intimacy * 0.08,
    tagMelancholy,
    0.44,
  );

  const destruction = clamp(
    Math.round(
      tasteProfile.heaviness * 0.34 +
        tasteProfile.aggression * 0.4 +
        tasteProfile.extremity * 0.26,
    ),
  );

  const catharsis = clamp(
    Math.round(
      tasteProfile.emotion * 0.3 +
        tasteProfile.energy * 0.2 +
        impact * 0.28 +
        tagCatharsis * 0.12 +
        scale * 0.1,
    ),
  );

  const euphoria = clamp(
    Math.round(
      tasteProfile.energy * 0.26 +
        tasteProfile.emotion * 0.2 +
        tasteProfile.club * 0.24 +
        warmth * 0.15 +
        brightness * 0.15,
    ),
  );

  const profile = refineVibeProfile(
    {
      nostalgia,
      euphoria,
      catharsis,
      destruction,
      scale,
      warmth,
      futurism,
      intimacy,
      playfulness,
      melancholy,
    },
    tasteProfile,
    usableTags,
  );

  return profile;
}

export function vibeScoreTier(score: number): VibeScoreTier {
  if (score >= 80) return "defining";
  if (score >= 60) return "high";
  if (score >= 30) return "moderate";
  return "low";
}

export function formatVibeDimensionLine(dimension: VibeDimension, score: number): string {
  const tier = vibeScoreTier(score);
  return `${dimension.padEnd(14)} ${String(Math.round(score)).padStart(3)}  (${tier})`;
}

export function formatVibeProfileBlock(profile: VibeProfile): string[] {
  return VIBE_DIMENSIONS.map((dimension) =>
    formatVibeDimensionLine(dimension, profile[dimension] ?? 0),
  );
}

/** Top human-facing vibe labels for display. */
export function getTopVibeLabels(profile: VibeProfile, limit = 3): string[] {
  return VIBE_DIMENSIONS.map((dimension) => ({
    dimension,
    score: profile[dimension] ?? 0,
    label: VIBE_DISPLAY_LABELS[dimension],
  }))
    .filter((entry) => entry.score >= 35)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.label);
}

export type VibeProfileSummary = {
  labels: string[];
  topDimensions: Array<{
    dimension: VibeDimension;
    score: number;
    tier: VibeScoreTier;
    label: string;
  }>;
  label: string;
  sentence: string;
};

export type VibeDirectionChip =
  | "more_euphoric"
  | "more_destructive"
  | "more_nostalgic"
  | "more_futuristic"
  | "more_intimate"
  | "more_melancholic";

export const VIBE_DIRECTION_LABELS: Record<VibeDirectionChip, string> = {
  more_euphoric: "More euphoric",
  more_destructive: "More destructive",
  more_nostalgic: "More nostalgic",
  more_futuristic: "More futuristic",
  more_intimate: "More intimate",
  more_melancholic: "More melancholic",
};

export function summariseVibeProfile(profile: VibeProfile): VibeProfileSummary {
  const topDimensions = VIBE_DIMENSIONS.map((dimension) => ({
    dimension,
    score: profile[dimension] ?? 0,
    tier: vibeScoreTier(profile[dimension] ?? 0),
    label: VIBE_DISPLAY_LABELS[dimension],
  }))
    .filter((entry) => entry.score >= 30)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  const labels = topDimensions.map((entry) => entry.label);
  const sentence = buildVibeSentence(labels);

  return {
    labels,
    topDimensions,
    label: labels.join(" · ") || "Mixed vibe",
    sentence,
  };
}

export function buildVibeSentence(labels: string[]): string {
  if (labels.length === 0) {
    return "This track sits in a mixed, hard-to-pin pocket.";
  }
  if (labels.length === 1) {
    return `This track sits in a ${labels[0]!.toLowerCase()} pocket.`;
  }
  if (labels.length === 2) {
    return `This track sits in a ${labels[0]!.toLowerCase()}, ${labels[1]!.toLowerCase()} pocket.`;
  }
  return `This track sits in a ${labels[0]!.toLowerCase()}, ${labels[1]!.toLowerCase()}, ${labels[2]!.toLowerCase()} pocket.`;
}

export function compareVibeProfiles(candidate: VibeProfile, root: VibeProfile): number {
  let sumSquaredDiff = 0;
  for (const dimension of VIBE_DIMENSIONS) {
    const diff = (candidate[dimension] ?? 0) - (root[dimension] ?? 0);
    sumSquaredDiff += diff * diff;
  }
  const maxDistance = Math.sqrt(VIBE_DIMENSIONS.length * 100 * 100);
  return Math.max(0, 1 - Math.sqrt(sumSquaredDiff) / maxDistance);
}

export function getVibeDirectionHints(
  candidate: VibeProfile,
  root: VibeProfile,
): VibeDirectionChip[] {
  const hints: VibeDirectionChip[] = [];
  const threshold = 15;

  if ((candidate.euphoria ?? 0) - (root.euphoria ?? 0) >= threshold) hints.push("more_euphoric");
  if ((candidate.destruction ?? 0) - (root.destruction ?? 0) >= threshold) {
    hints.push("more_destructive");
  }
  if ((candidate.nostalgia ?? 0) - (root.nostalgia ?? 0) >= threshold) hints.push("more_nostalgic");
  if ((candidate.futurism ?? 0) - (root.futurism ?? 0) >= threshold) hints.push("more_futuristic");
  if ((candidate.intimacy ?? 0) - (root.intimacy ?? 0) >= threshold) hints.push("more_intimate");
  if ((candidate.melancholy ?? 0) - (root.melancholy ?? 0) >= threshold) {
    hints.push("more_melancholic");
  }

  return hints;
}

export function getAvailableVibeDirections(root: VibeProfile): VibeDirectionChip[] {
  const options: VibeDirectionChip[] = [];
  if ((root.euphoria ?? 0) < 70) options.push("more_euphoric");
  if ((root.destruction ?? 0) < 70) options.push("more_destructive");
  if ((root.nostalgia ?? 0) < 70) options.push("more_nostalgic");
  if ((root.futurism ?? 0) < 70) options.push("more_futuristic");
  if ((root.intimacy ?? 0) < 70) options.push("more_intimate");
  if ((root.melancholy ?? 0) < 70) options.push("more_melancholic");
  return options;
}

export function buildVibeCandidateReason(input: {
  candidateVibe: VibeProfile;
  rootVibe: VibeProfile;
  similarArtist?: string;
  sharedTags: string[];
  tasteCloseness: number;
  source: "lastfm_similar_artist" | "lastfm_tag_seed";
}): string {
  const labels = getTopVibeLabels(input.candidateVibe, 3);
  const vibePhrase =
    labels.length >= 2
      ? `A ${labels.slice(0, 3).join(", ")} route`
      : labels.length === 1
        ? `A ${labels[0]!.toLowerCase()} route`
        : "A nearby vibe";

  const tastePart =
    input.tasteCloseness >= 0.72
      ? "with a close taste match"
      : input.tasteCloseness >= 0.55
        ? "with a similar taste profile"
        : "with an adjacent taste profile";

  const artistPart = input.similarArtist
    ? ` via Last.fm neighbour ${input.similarArtist}`
    : input.source === "lastfm_tag_seed"
      ? " from a shared Last.fm tag lane"
      : " on Last.fm";

  const tagPart =
    input.sharedTags.length > 0
      ? ` (${input.sharedTags.slice(0, 3).join(", ")})`
      : "";

  return `${vibePhrase}${artistPart} — ${tastePart}${tagPart}.`;
}

export type VibeExpectation = {
  label: string;
  checks: Array<{
    dimension: VibeDimension;
    min?: number;
    max?: number;
  }>;
};

export function assertVibeExpectations(
  artist: string,
  profile: VibeProfile,
  expectations: VibeExpectation[],
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

export const VIBE_EXPECTATIONS: VibeExpectation[] = [
  {
    label: "Knocked Loose",
    checks: [
      { dimension: "destruction", min: 90 },
      { dimension: "catharsis", min: 80 },
    ],
  },
  {
    label: "Ninajirachi",
    checks: [
      { dimension: "nostalgia", min: 65 },
      { dimension: "futurism", min: 75 },
      { dimension: "playfulness", min: 60 },
    ],
  },
  {
    label: "M83",
    checks: [
      { dimension: "nostalgia", min: 80 },
      { dimension: "scale", min: 80 },
    ],
  },
  {
    label: "Fred again..",
    checks: [
      { dimension: "euphoria", min: 75 },
      { dimension: "catharsis", min: 60 },
    ],
  },
  {
    label: "Burial",
    checks: [
      { dimension: "melancholy", min: 75 },
      { dimension: "intimacy", min: 50 },
    ],
  },
  {
    label: "SOPHIE",
    checks: [
      { dimension: "futurism", min: 90 },
      { dimension: "playfulness", min: 60 },
    ],
  },
];

export function tagsToWeightedTags(
  tags: Array<{ name: string; weight: number }>,
): WeightedTag[] {
  return tags.map((tag) => ({ name: tag.name, weight: tag.weight }));
}
