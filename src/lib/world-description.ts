import { groupStoryNodes } from "@/lib/story-sections";
import { formatArtists } from "@/lib/format";
import type {
  MusicStory,
  PlaylistCandidate,
  Track,
  VibeSignature,
} from "@/lib/types";

const VIBE_ADJECTIVES: Record<string, string> = {
  euphoric: "euphoric",
  destructive: "destructive",
  nostalgic: "nostalgic",
  futuristic: "futuristic",
  intimate: "intimate",
  melancholic: "melancholic",
  clubby: "club-focused",
  emotional: "emotional",
  underground: "underground",
  weird: "left-field",
};

const GENERIC_VIBE_WORDS = new Set(["electronic", "pop", "club", "dance", "house"]);

function withVibe(
  vibeAdj: string | null,
  fallback: string,
  genreWord: string,
): string {
  const useVibe =
    vibeAdj &&
    !genreWord.includes(vibeAdj) &&
    !GENERIC_VIBE_WORDS.has(vibeAdj);
  return useVibe ? `${vibeAdj} ` : `${fallback} `;
}

function withArticle(phrase: string): string {
  const trimmed = phrase.trim();
  const first = trimmed.split(/\s+/)[0] ?? "";
  const article = /^[aeiou]/i.test(first) ? "An" : "A";
  return `${article} ${trimmed}`;
}

const GENRE_NARRATIVES: Array<{
  match: (tags: string[]) => boolean;
  sentence: (vibeAdj: string | null) => string;
}> = [
  {
    match: (tags) => tags.some((t) => /ambient|dubstep|2-step/i.test(t)),
    sentence: (v) =>
      `${withArticle(
        `${withVibe(v, "melancholic", "electronic")}electronic track shaped by late-night city atmosphere`,
      )}.`,
  },
  {
    match: (tags) => tags.some((t) => /hyperpop|pc music/i.test(t)),
    sentence: (v) =>
      `A ${withVibe(v, "futuristic", "hyperpop")}hyperpop track sitting between club music and internet culture.`,
  },
  {
    match: (tags) => tags.some((t) => /metalcore|hardcore|beatdown/i.test(t)),
    sentence: (v) =>
      `A ${withVibe(v, "destructive", "metalcore")}metalcore track driven by catharsis and aggression.`,
  },
  {
    match: (tags) =>
      tags.some((t) => /uk garage|uk bass|garage|grime|uk funky/i.test(t)),
    sentence: (v) =>
      `A ${withVibe(v, "nostalgic", "garage")}future-garage track rooted in UK bass culture.`,
  },
  {
    match: (tags) => tags.some((t) => /pop|dance|club/i.test(t)),
    sentence: (v) =>
      `A ${withVibe(v, "euphoric", "pop")}pop track built for the dancefloor and its afterglow.`,
  },
];

function normaliseTag(value: string): string {
  return value.toLowerCase().replace(/^more[_\s]+/, "").trim();
}

function collectSceneTags(
  story: Pick<MusicStory, "nodes" | "edges" | "rootTrack">,
): { genres: string[]; scenes: string[] } {
  const section = groupStoryNodes(story as MusicStory).find(
    (s) => s.id === "genre-scene",
  );
  const nodes = section?.nodes ?? [];
  return {
    genres: nodes.filter((n) => n.type === "genre").map((n) => n.title),
    scenes: nodes.filter((n) => n.type === "scene").map((n) => n.title),
  };
}

function collectPlaylistHints(playlist?: PlaylistCandidate): string[] {
  const counts = new Map<string, number>();

  for (const track of playlist?.tracks ?? []) {
    for (const label of track.vibeProfile?.labels ?? []) {
      const key = normaliseTag(label);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    if (track.directionLabel) {
      const key = normaliseTag(track.directionLabel);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const reason = track.reason.toLowerCase();
    for (const token of [
      "hyperpop",
      "metalcore",
      "hardcore",
      "uk garage",
      "garage",
      "electronic",
      "house",
      "techno",
      "ambient",
      "pop",
    ]) {
      if (reason.includes(token)) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tag]) => tag);
}

function pickVibeAdjective(
  vibeSignature: VibeSignature | null,
  playlistHints: string[],
): string | null {
  const raw =
    vibeSignature?.labels[0] ??
    playlistHints.find((h) => VIBE_ADJECTIVES[h]) ??
    playlistHints[0];
  if (!raw) return null;
  const key = normaliseTag(raw);
  return VIBE_ADJECTIVES[key] ?? key.replace(/_/g, " ");
}

function scenePhrase(scenes: string[], genres: string[]): string | null {
  if (scenes.length > 0) return scenes[0]!;
  if (genres.length >= 2) {
    return `${genres[0]} and ${genres[1]} culture`;
  }
  if (genres.length === 1) return `${genres[0]} culture`;
  return null;
}

function composeGeneric(
  vibeAdj: string | null,
  primaryGenre: string | null,
  scene: string | null,
  artist: string,
): string {
  const vibePart = vibeAdj ? `${vibeAdj} ` : "";
  const genrePart = primaryGenre ?? "electronic";
  const scenePart = scene ? ` rooted in ${scene}` : ` orbiting ${artist}'s world`;

  return `${withArticle(`${vibePart}${genrePart} track${scenePart}`)}.`;
}

export function buildWorldDescription(input: {
  rootTrack: Track;
  vibeSignature: VibeSignature | null;
  storyForScene: Pick<MusicStory, "nodes" | "edges" | "rootTrack">;
  playlist?: PlaylistCandidate;
}): string {
  const { genres, scenes } = collectSceneTags(input.storyForScene);
  const playlistHints = collectPlaylistHints(input.playlist);
  const allTags = [
    ...genres.map((g) => g.toLowerCase()),
    ...scenes.map((s) => s.toLowerCase()),
    ...playlistHints,
  ];

  const vibeAdj = pickVibeAdjective(input.vibeSignature, playlistHints);
  const artist = formatArtists(input.rootTrack);

  if (input.vibeSignature?.sentence) {
    const trimmed = input.vibeSignature.sentence.trim();
    if (trimmed.length > 20 && trimmed.length < 140 && trimmed.endsWith(".")) {
      return trimmed;
    }
    if (trimmed.length > 20 && trimmed.length < 130) {
      return trimmed.endsWith(".") ? trimmed : `${trimmed}.`;
    }
  }

  for (const narrative of GENRE_NARRATIVES) {
    if (narrative.match(allTags)) {
      return narrative.sentence(vibeAdj);
    }
  }

  const primaryGenre = genres[0]?.toLowerCase() ?? playlistHints[0] ?? null;
  const scene = scenePhrase(scenes, genres);

  return composeGeneric(vibeAdj, primaryGenre, scene, artist);
}
