import type { BeyondCandidate, BeyondConnectionType, BeyondMatchMethod } from "./types";

export function computeMusicalAdjacencyScore(input: {
  connectionType: BeyondConnectionType;
  matchMethod: BeyondMatchMethod;
  artistConfidence?: "high" | "medium" | "low";
  combinedLastfmScore?: number;
}): number {
  if (typeof input.combinedLastfmScore === "number") {
    return Math.round(input.combinedLastfmScore * 10);
  }

  let score = 0;

  switch (input.connectionType) {
    case "lastfm_similar_artist":
      score += 6;
      break;
    case "lastfm_tag_seed":
      score += 5;
      break;
    case "genre_seed":
    case "scene_seed":
      score += 4;
      break;
    case "featured_artist":
      score += 3;
      break;
    case "same_artist":
      score += 2;
      break;
    case "musicbrainz_related":
      score += 2;
      break;
    case "producer_credit":
    case "songwriter_credit":
      if (input.artistConfidence === "high") score += 1;
      break;
    case "fallback":
      score -= 3;
      break;
  }

  if (input.matchMethod === "title_only") score -= 5;

  return score;
}

export function selectBeyondCandidates(candidates: BeyondCandidate[]): BeyondCandidate[] {
  const usable = candidates.filter((candidate) => candidate.matchMethod !== "title_only");
  const selected: BeyondCandidate[] = [];
  const usedKeys = new Set<string>();

  const pick = (type: BeyondConnectionType | BeyondConnectionType[], max: number) => {
    if (max <= 0) return;

    const types = Array.isArray(type) ? type : [type];
    const pool = usable
      .filter(
        (candidate) =>
          types.includes(candidate.connectionType) && !usedKeys.has(candidate.key),
      )
      .sort((a, b) => b.musicalAdjacencyScore - a.musicalAdjacencyScore);

    for (const candidate of pool.slice(0, max)) {
      selected.push(candidate);
      usedKeys.add(candidate.key);
    }
  };

  pick("lastfm_similar_artist", 4);
  pick("lastfm_tag_seed", 5 - selected.length);

  for (const type of ["scene_seed", "genre_seed"] as const) {
    if (selected.length >= 5) break;
    pick(type, 5 - selected.length);
  }

  if (selected.length < 3) {
    pick("fallback", 3 - selected.length);
  }

  if (selected.length < 3) {
    pick("musicbrainz_related", 1);
  }

  if (selected.length < 3) {
    pick(["producer_credit", "songwriter_credit"], 1);
  }

  if (selected.length < 3) {
    pick("same_artist", 1);
  }

  return selected.slice(0, 5);
}
