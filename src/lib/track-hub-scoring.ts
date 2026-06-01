import type { FacetId, FacetPortal, FacetPortalLayout } from "./track-hub-summaries";

export type FacetRichnessBreakdown = {
  id: FacetId;
  score: number;
  available: boolean;
  signals: string[];
};

const FACET_TIEBREAK: Record<FacetId, number> = {
  scene: 60,
  people: 50,
  vibe: 40,
  playlist: 30,
  release: 20,
  connected: 10,
};

/** Empty or placeholder-only facets cannot be featured. */
const MIN_FEATURED_SCORE = 12;

export function scoreScenePortal(
  portal: Extract<FacetPortal, { id: "scene" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return { id: "scene", score: 0, available: false, signals: ["no genre/scene nodes"] };
  }

  const signals: string[] = [];
  let score = 0;

  score += portal.genreCount * 8;
  if (portal.genreCount > 0) signals.push(`${portal.genreCount} genres`);

  score += portal.sceneCount * 10;
  if (portal.sceneCount > 0) signals.push(`${portal.sceneCount} scenes`);

  score += portal.chips.length * 4;
  if (portal.chips.length > 0) signals.push(`${portal.chips.length} chips shown`);

  const teaserIsRich =
    portal.teaser.length > 28 &&
    !portal.teaser.startsWith("Genres and scenes");
  if (teaserIsRich) {
    score += 8;
    signals.push("rich teaser");
  }

  return { id: "scene", score, available: true, signals };
}

export function scorePeoplePortal(
  portal: Extract<FacetPortal, { id: "people" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return { id: "people", score: 0, available: false, signals: ["no credits"] };
  }

  const signals: string[] = [];
  let score = 0;

  score += portal.totalCount * 6;
  signals.push(`${portal.totalCount} contributors`);

  score += portal.avatars.length * 9;
  signals.push(`${portal.avatars.length} avatars`);

  if (portal.namePreview && !portal.namePreview.includes("Credits and")) {
    score += 10;
    signals.push("named preview");
  }

  return { id: "people", score, available: true, signals };
}

export function scorePlaylistPortal(
  portal: Extract<FacetPortal, { id: "playlist" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return { id: "playlist", score: 0, available: false, signals: ["no rec pool"] };
  }

  if (portal.trackCount === 0) {
    return {
      id: "playlist",
      score: 4,
      available: true,
      signals: ["degraded / warming (no tracks yet)"],
    };
  }

  const signals: string[] = [];
  let score = 0;

  score += Math.min(portal.trackCount, 24) * 3;
  signals.push(`${portal.trackCount} recommendations`);

  score += portal.coverUrls.length * 9;
  signals.push(`${portal.coverUrls.length} artworks`);

  return { id: "playlist", score, available: true, signals };
}

export function scoreReleasePortal(
  portal: Extract<FacetPortal, { id: "release" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return { id: "release", score: 0, available: false, signals: ["no album"] };
  }

  const signals: string[] = [];
  let score = 0;

  if (portal.albumTitle) {
    score += 10;
    signals.push("album");
  }
  if (portal.year) {
    score += 14;
    signals.push("year");
  }
  if (portal.label) {
    score += 22;
    signals.push("label");
  }
  if (portal.catalogStamp) {
    score += 10;
    signals.push("catalog/format");
  }

  return { id: "release", score, available: true, signals };
}

export function scoreConnectedPortal(
  portal: Extract<FacetPortal, { id: "connected" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return {
      id: "connected",
      score: 0,
      available: false,
      signals: ["no linked tracks"],
    };
  }

  const artCount = portal.previews.filter((p) => p.artworkUrl).length;
  const signals: string[] = [
    `${portal.previews.length} previews`,
    `${artCount} with artwork`,
  ];

  const score =
    portal.previews.length * 14 + artCount * 8;

  return { id: "connected", score, available: true, signals };
}

export function scoreVibePortal(
  portal: Extract<FacetPortal, { id: "vibe" }>,
): FacetRichnessBreakdown {
  if (!portal.available) {
    return { id: "vibe", score: 0, available: false, signals: ["no Last.fm vibe"] };
  }

  const signals: string[] = [];
  let score = 0;

  score += portal.chips.length * 11;
  signals.push(`${portal.chips.length} vibe labels`);

  if (portal.sentence && portal.sentence.length > 20) {
    score += 18;
    signals.push("taste sentence");
  }

  return { id: "vibe", score, available: true, signals };
}

export function scoreFacetPortal(portal: FacetPortal): FacetRichnessBreakdown {
  switch (portal.id) {
    case "scene":
      return scoreScenePortal(portal);
    case "people":
      return scorePeoplePortal(portal);
    case "playlist":
      return scorePlaylistPortal(portal);
    case "release":
      return scoreReleasePortal(portal);
    case "connected":
      return scoreConnectedPortal(portal);
    case "vibe":
      return scoreVibePortal(portal);
    default: {
      const _exhaustive: never = portal;
      return _exhaustive;
    }
  }
}

function compareBreakdowns(a: FacetRichnessBreakdown, b: FacetRichnessBreakdown): number {
  if (b.score !== a.score) return b.score - a.score;
  return FACET_TIEBREAK[b.id] - FACET_TIEBREAK[a.id];
}

export function explainFeaturedFacet(
  featuredId: FacetId,
  breakdowns: FacetRichnessBreakdown[],
): string {
  const winner = breakdowns.find((b) => b.id === featuredId);
  if (!winner) return `Featured ${featuredId} (fallback).`;

  const runnerUp = breakdowns.find(
    (b) => b.id !== featuredId && b.available && b.score > 0,
  );

  const margin =
    runnerUp && winner.score > runnerUp.score
      ? ` (+${winner.score - runnerUp.score} vs ${runnerUp.id})`
      : "";

  return `${winner.id} scored ${winner.score}${margin} — ${winner.signals.join(", ")}`;
}

export function assignFacetLayouts(portals: FacetPortal[]): {
  portals: FacetPortal[];
  breakdowns: FacetRichnessBreakdown[];
  featuredId: FacetId;
  featuredReason: string;
} {
  const breakdowns = portals.map(scoreFacetPortal).sort(compareBreakdowns);

  const eligible = breakdowns.filter((b) => b.available && b.score > 0);

  const featuredCandidate = eligible.find((b) => b.score >= MIN_FEATURED_SCORE);
  const featuredId =
    featuredCandidate?.id ??
    eligible[0]?.id ??
    breakdowns.find((b) => b.available)?.id ??
    "release";

  const featuredReason = explainFeaturedFacet(featuredId, breakdowns);

  const rankedIds = breakdowns.map((b) => b.id);
  const secondaryIds = new Set(
    eligible
      .filter((b) => b.id !== featuredId)
      .slice(0, 2)
      .map((b) => b.id),
  );

  const withLayouts = portals.map((portal) => {
    let layout: FacetPortalLayout = "standard";
    if (portal.id === featuredId) layout = "featured";
    else if (secondaryIds.has(portal.id)) layout = "tall";
    return { ...portal, layout };
  });

  const order = new Map(rankedIds.map((id, index) => [id, index]));
  const ordered = [...withLayouts].sort(
    (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99),
  );

  return { portals: ordered, breakdowns, featuredId, featuredReason };
}

export function formatRichnessReport(
  label: string,
  breakdowns: FacetRichnessBreakdown[],
  featuredId: FacetId,
): string {
  const lines = breakdowns.map((b) => {
    const tag = b.id === featuredId ? " ★ featured" : "";
    return `  ${b.id.padEnd(10)} ${String(b.score).padStart(3)}  [${b.signals.join(", ")}]${tag}`;
  });
  return `${label}\n${lines.join("\n")}`;
}
