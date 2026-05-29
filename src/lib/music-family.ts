import type { PathRoute } from "./types";
import type { TasteProfile } from "./tasteProfile";

export type MusicFamily =
  | "electronic"
  | "pop"
  | "rock"
  | "metal"
  | "hiphop"
  | "folk"
  | "jazz"
  | "classical"
  | "ambient"
  | "unknown";

export type TagLike = { name: string; weight?: number };

export type FamilyCompatibility = {
  allowed: boolean;
  penalty: number;
  label?: string;
  rejectReason?: string;
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
  "british",
  "american",
  "english",
  "australian",
  "awesome",
  "beautiful",
  "love",
  "loved",
  "under 2000 listeners",
  "check out",
  "must see live",
]);

/** Tags too broad to infer family on their own. */
export const WEAK_FAMILY_TAGS = new Set([
  "alternative",
  "alternative rock",
  "rock",
  "indie",
  "indie rock",
  "experimental",
  "seen live",
  "favourites",
  "favorites",
  "favorite",
  "favourite",
  "all",
  "other",
  "miscellaneous",
  "notag",
]);

/** Last.fm tag → family signal strengths (0–100). */
const FAMILY_TAG_SIGNALS: Record<string, Partial<Record<MusicFamily, number>>> = {
  hyperpop: { electronic: 95, pop: 75 },
  "bubblegum bass": { electronic: 92, pop: 65 },
  "pc music": { electronic: 88, pop: 60 },
  electropop: { electronic: 80, pop: 85 },
  synthpop: { electronic: 75, pop: 70 },
  "dance-pop": { pop: 85, electronic: 70 },
  "dance pop": { pop: 85, electronic: 70 },
  pop: { pop: 90 },
  "art pop": { pop: 70, electronic: 45 },
  house: { electronic: 88 },
  techno: { electronic: 90 },
  trance: { electronic: 85 },
  edm: { electronic: 88 },
  "uk garage": { electronic: 88 },
  "future garage": { electronic: 85, ambient: 45 },
  garage: { electronic: 80 },
  dubstep: { electronic: 85, ambient: 40 },
  "drum and bass": { electronic: 85 },
  dnb: { electronic: 85 },
  breakbeat: { electronic: 78 },
  electronic: { electronic: 90 },
  electronica: { electronic: 85 },
  idm: { electronic: 88 },
  ambient: { ambient: 90, electronic: 55 },
  "progressive house": { electronic: 82 },
  "deep house": { electronic: 80 },
  "electro house": { electronic: 85 },
  "tech house": { electronic: 82 },
  dance: { electronic: 70, pop: 55 },
  rave: { electronic: 80 },
  "stutter house": { electronic: 82 },
  "future bass": { electronic: 78, pop: 50 },
  brat: { electronic: 88, pop: 72 },

  metal: { metal: 92 },
  "heavy metal": { metal: 90 },
  "thrash metal": { metal: 92 },
  thrash: { metal: 90 },
  metalcore: { metal: 88 },
  deathcore: { metal: 92 },
  hardcore: { metal: 85 },
  "hardcore punk": { metal: 82 },
  "progressive metal": { metal: 85 },
  "death metal": { metal: 95 },
  "black metal": { metal: 95 },
  posthardcore: { metal: 78, rock: 55 },
  "post-hardcore": { metal: 78, rock: 55 },

  "alternative rock": { rock: 75 },
  "indie rock": { rock: 78 },
  rock: { rock: 85 },
  "progressive rock": { rock: 82 },
  shoegaze: { rock: 70, ambient: 45 },
  postrock: { rock: 75, ambient: 50 },
  "post-rock": { rock: 75, ambient: 50 },

  hiphop: { hiphop: 90 },
  "hip-hop": { hiphop: 90 },
  rap: { hiphop: 88 },
  "hip hop": { hiphop: 90 },

  folk: { folk: 90 },
  acoustic: { folk: 75 },
  country: { folk: 70 },

  jazz: { jazz: 90 },
  classical: { classical: 95 },
  opera: { classical: 90 },
};

const ADJACENT_FAMILIES: Record<MusicFamily, MusicFamily[]> = {
  electronic: ["electronic", "pop", "ambient"],
  pop: ["pop", "electronic"],
  ambient: ["ambient", "electronic"],
  metal: ["metal", "rock"],
  rock: ["rock", "metal"],
  hiphop: ["hiphop", "pop"],
  folk: ["folk"],
  jazz: ["jazz"],
  classical: ["classical"],
  unknown: ["unknown"],
};

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function initFamilyScores(): Record<MusicFamily, number> {
  return {
    electronic: 0,
    pop: 0,
    rock: 0,
    metal: 0,
    hiphop: 0,
    folk: 0,
    jazz: 0,
    classical: 0,
    ambient: 0,
    unknown: 0,
  };
}

export function isWeakFamilyTag(tagName: string): boolean {
  return WEAK_FAMILY_TAGS.has(normalise(tagName));
}

export function filterStrongTags(tags: TagLike[]): TagLike[] {
  return tags.filter((tag) => {
    const name = normalise(tag.name);
    return !JUNK_TAGS.has(name) && !WEAK_FAMILY_TAGS.has(name);
  });
}

export function getMusicFamily(
  profile: TasteProfile | null | undefined,
  tags: TagLike[],
): MusicFamily {
  const scores = initFamilyScores();
  const strongTags = filterStrongTags(tags);
  const usableTags = strongTags.length > 0 ? strongTags : tags.filter(
    (tag) => !JUNK_TAGS.has(normalise(tag.name)),
  );

  for (const tag of usableTags) {
    const key = normalise(tag.name);
    const signals = FAMILY_TAG_SIGNALS[key];
    if (!signals) continue;
    const weight = tag.weight ?? 1;
    for (const [family, value] of Object.entries(signals)) {
      scores[family as MusicFamily] += value * weight;
    }
  }

  if (profile) {
    if (profile.electronic >= 55) scores.electronic += profile.electronic * 0.55;
    if (profile.club >= 55) scores.electronic += profile.club * 0.35;
    if (profile.mainstream >= 60) scores.pop += profile.mainstream * 0.45;
    if (profile.heaviness >= 65 && profile.aggression >= 55) {
      scores.metal += (profile.heaviness + profile.aggression) * 0.35;
    } else if (profile.heaviness >= 55) {
      scores.rock += profile.heaviness * 0.35;
    }
    if (profile.acoustic >= 65) scores.folk += profile.acoustic * 0.45;
    if (profile.softness >= 70 && profile.electronic < 50) {
      scores.ambient += profile.softness * 0.35;
    }
  }

  const ranked = Object.entries(scores)
    .filter(([family]) => family !== "unknown")
    .sort((a, b) => b[1] - a[1]);

  const best = ranked[0];
  if (!best || best[1] < 25) return "unknown";
  return best[0] as MusicFamily;
}

export function getAllowedFamilies(root: MusicFamily): MusicFamily[] {
  return ADJACENT_FAMILIES[root] ?? [root];
}

/** Stricter family set for "close" / familiar rabbit holes. */
const CLOSE_MATCH_FAMILIES: Record<MusicFamily, MusicFamily[]> = {
  electronic: ["electronic", "ambient"],
  pop: ["pop"],
  ambient: ["ambient", "electronic"],
  metal: ["metal", "rock"],
  rock: ["rock", "metal"],
  hiphop: ["hiphop"],
  folk: ["folk"],
  jazz: ["jazz"],
  classical: ["classical"],
  unknown: ["unknown"],
};

export function getCloseMatchFamilies(root: MusicFamily): MusicFamily[] {
  return CLOSE_MATCH_FAMILIES[root] ?? [root];
}

export function sharedStrongTags(
  rootTags: TagLike[],
  candidateTags: TagLike[],
): string[] {
  const rootSet = new Set(filterStrongTags(rootTags).map((tag) => normalise(tag.name)));
  return filterStrongTags(candidateTags)
    .map((tag) => tag.name)
    .filter((name) => rootSet.has(normalise(name)));
}

export function assessFamilyCompatibility(
  rootFamily: MusicFamily,
  candidateFamily: MusicFamily,
  hole: PathRoute,
  lastfmMatch = 0,
): FamilyCompatibility {
  if (rootFamily === "unknown" || candidateFamily === "unknown") {
    return { allowed: true, penalty: 0 };
  }

  const allowedSet =
    hole === "familiar"
      ? getCloseMatchFamilies(rootFamily)
      : getAllowedFamilies(rootFamily);
  const compatible = allowedSet.includes(candidateFamily);

  if (hole === "familiar") {
    if (!compatible) {
      return {
        allowed: false,
        penalty: 1,
        rejectReason: `family mismatch (${candidateFamily} not in ${allowedSet.join("/")} for ${rootFamily})`,
      };
    }
    return { allowed: true, penalty: 0 };
  }

  if (hole === "adjacent") {
    if (!compatible) {
      const penalty = lastfmMatch >= 0.75 ? 0.2 : 0.5;
      return {
        allowed: true,
        penalty,
        label: lastfmMatch >= 0.75 ? undefined : "distant family",
        rejectReason: `adjacent family mismatch (${candidateFamily} vs ${rootFamily})`,
      };
    }
    return { allowed: true, penalty: 0 };
  }

  if (!compatible) {
    return { allowed: true, penalty: 0, label: "left-field" };
  }
  return { allowed: true, penalty: 0 };
}

export function assignPathRoute(input: {
  tasteCloseness: number;
  rootFamily: MusicFamily;
  candidateFamily: MusicFamily;
  strongSharedTagCount: number;
  lastfmMatch?: number;
  weakTagsOnly?: boolean;
}): PathRoute {
  let closeness = input.tasteCloseness;
  if (input.weakTagsOnly && input.strongSharedTagCount === 0) {
    closeness = Math.min(closeness, 0.44);
  }

  const familiarCompat = assessFamilyCompatibility(
    input.rootFamily,
    input.candidateFamily,
    "familiar",
    input.lastfmMatch ?? 0,
  );
  if (
    familiarCompat.allowed &&
    closeness >= 0.72 &&
    (input.strongSharedTagCount >= 1 || (input.lastfmMatch ?? 0) >= 0.55)
  ) {
    return "familiar";
  }

  const adjacentCompat = assessFamilyCompatibility(
    input.rootFamily,
    input.candidateFamily,
    "adjacent",
    input.lastfmMatch ?? 0,
  );
  if (adjacentCompat.allowed && closeness >= 0.45) {
    return "adjacent";
  }

  if (!adjacentCompat.allowed && (input.lastfmMatch ?? 0) >= 0.75 && closeness >= 0.45) {
    return "adjacent";
  }

  return "stranger";
}

export function isMetalOrRockArtist(artistLabel: string): boolean {
  const markers =
    /\b(tool|metallica|slayer|megadeth|iron maiden|black sabbath|deftones|korn|slipknot|park|maiden|meshuggah|prog\b)/i;
  return markers.test(artistLabel);
}

export function isPopOrMainstreamArtist(artistLabel: string): boolean {
  const markers =
    /\b(nicki minaj|dua lipa|harry styles|justin bieber|taylor swift|ed sheeran|the weeknd|billie eilish|coldplay|chainsmokers)/i;
  return markers.test(artistLabel);
}

export type CandidateDebugRow = {
  title: string;
  artist: string;
  hole: PathRoute | "pool";
  musicFamily: MusicFamily;
  rootMusicFamily: MusicFamily;
  sharedTags: string[];
  score: number;
  rejectedReason?: string;
  accepted: boolean;
};

export function logCandidateDebug(rows: CandidateDebugRow[]): void {
  if (process.env.RABBIT_HOLE_DEBUG !== "1") return;
  console.log("\n--- Rabbit hole candidate debug ---");
  for (const row of rows) {
    console.log(
      `${row.accepted ? "✓" : "✗"} ${row.title} — ${row.artist}`,
      `[${row.hole}]`,
      `family=${row.musicFamily}`,
      `root=${row.rootMusicFamily}`,
      `shared=${row.sharedTags.join(",") || "none"}`,
      `score=${row.score.toFixed(3)}`,
      row.rejectedReason ? `REJECT: ${row.rejectedReason}` : "",
    );
  }
}
