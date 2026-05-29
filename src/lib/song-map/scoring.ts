import type { SongMapNodeKind, SongMapNodeSignals } from "./types";

const SOFT_KEYWORDS = [
  "acoustic",
  "piano",
  "ballad",
  "ambient",
  "chill",
  "slow",
  "soft",
  "strings",
  "orchestral",
  "unplugged",
  "lullaby",
  "gentle",
];

const HEAVY_KEYWORDS = [
  "bass",
  "dub",
  "techno",
  "metal",
  "hard",
  "industrial",
  "club",
  "drop",
  "hammer",
  "distort",
  "rave",
  "drum",
];

const CLUB_KEYWORDS = [
  "club",
  "dance",
  "house",
  "techno",
  "disco",
  "edit",
  "remix",
  "party",
  "floor",
  "mix",
];

const EMOTIONAL_KEYWORDS = [
  "love",
  "heart",
  "cry",
  "tears",
  "alone",
  "miss",
  "farewell",
  "goodbye",
  "soul",
  "feel",
  "blue",
  "hurt",
];

const UNDERGROUND_KEYWORDS = [
  "underground",
  "dub",
  "warehouse",
  "basement",
  "bootleg",
  "white label",
  "niche",
  "deep",
  "raw",
];

const WEIRD_KEYWORDS = [
  "remix",
  "edit",
  "bootleg",
  "flip",
  "experimental",
  "weird",
  "strange",
  "flip",
  "rework",
  "version",
];

function keywordScore(text: string, keywords: string[]): number {
  const haystack = text.toLowerCase();
  let hits = 0;

  for (const keyword of keywords) {
    if (haystack.includes(keyword)) hits += 1;
  }

  return Math.min(1, hits / 3);
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

const KIND_FAMILIARITY: Record<SongMapNodeKind, number> = {
  root: 0,
  same_artist: 0.18,
  collaborator: 0.38,
  connected: 0.45,
  genre_scene: 0.68,
  curated_fallback: 0.88,
};

export function scoreSongMapSignals(input: {
  title: string;
  artist: string;
  kind: SongMapNodeKind;
  albumTitle?: string;
  genreHints?: string[];
}): SongMapNodeSignals {
  const corpus = [input.title, input.artist, input.albumTitle ?? ""]
    .concat(input.genreHints ?? [])
    .join(" ");

  const soft = keywordScore(corpus, SOFT_KEYWORDS);
  const heavy = keywordScore(corpus, HEAVY_KEYWORDS);
  const weight = clamp(0.5 + (heavy - soft) * 0.45);

  const familiarity = clamp(
    KIND_FAMILIARITY[input.kind] +
      keywordScore(corpus, WEIRD_KEYWORDS) * 0.08 +
      keywordScore(corpus, UNDERGROUND_KEYWORDS) * 0.06,
  );

  return {
    familiarity,
    weight,
    club: keywordScore(corpus, CLUB_KEYWORDS),
    emotional: keywordScore(corpus, EMOTIONAL_KEYWORDS),
    underground: keywordScore(corpus, UNDERGROUND_KEYWORDS),
    weird: keywordScore(corpus, WEIRD_KEYWORDS),
  };
}

export function scoreSongMapCandidate(input: {
  signals: SongMapNodeSignals;
  confidence: number;
  kind: SongMapNodeKind;
}): number {
  const proximityBonus =
    input.kind === "same_artist"
      ? 0.25
      : input.kind === "collaborator"
        ? 0.15
        : input.kind === "connected"
          ? 0.1
          : 0;

  return clamp(
    input.confidence * 0.55 +
      (1 - input.signals.familiarity) * 0.15 +
      proximityBonus +
      input.signals.club * 0.05,
  );
}

export function placeSongMapNode(input: {
  kind: SongMapNodeKind;
  signals: SongMapNodeSignals;
  index: number;
  total: number;
  id: string;
}): { x: number; y: number } {
  if (input.kind === "root") {
    return { x: 0.5, y: 0.5 };
  }

  const bands: Record<
    Exclude<SongMapNodeKind, "root">,
    { y: number; radius: number }
  > = {
    same_artist: { y: 0.28, radius: 0.11 },
    collaborator: { y: 0.4, radius: 0.17 },
    connected: { y: 0.48, radius: 0.21 },
    genre_scene: { y: 0.66, radius: 0.27 },
    curated_fallback: { y: 0.82, radius: 0.33 },
  };

  const band = bands[input.kind];
  const angle =
    input.total <= 1
      ? -Math.PI / 2
      : (input.index / input.total) * Math.PI * 2 - Math.PI / 2;
  const hash = [...input.id].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const jitter = ((hash % 100) / 100 - 0.5) * 0.04;

  const x =
    0.5 +
    Math.cos(angle) * band.radius +
    (input.signals.weight - 0.5) * 0.18 +
    jitter;
  const y =
    band.y +
    Math.sin(angle) * band.radius * 0.35 +
    input.signals.familiarity * 0.08 +
    jitter * 0.5;

  return {
    x: clamp(x, 0.08, 0.92),
    y: clamp(y, 0.08, 0.92),
  };
}

export function applyDirectionBias(
  x: number,
  y: number,
  signals: SongMapNodeSignals,
  direction: { dx: number; dy: number },
): { x: number; y: number } {
  const signalBoost =
    direction.dx > 0
      ? signals.weight * 0.04
      : direction.dx < 0
        ? (1 - signals.weight) * 0.04
        : 0;

  const strangeBoost = direction.dy > 0 ? signals.weird * 0.04 + signals.underground * 0.03 : 0;

  return {
    x: clamp(x + direction.dx + signalBoost),
    y: clamp(y + direction.dy + strangeBoost),
  };
}
